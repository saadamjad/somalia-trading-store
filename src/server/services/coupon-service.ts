import type { Coupon, Prisma } from "@/generated/prisma/client";
import { couponRepository } from "@/server/repositories/coupon-repository";

export class CouponNotFoundError extends Error {
  constructor() {
    super("Coupon code not found.");
    this.name = "CouponNotFoundError";
  }
}

/** Thrown for every "this coupon can't be used right now" reason — inactive,
 * outside its date window, usage limit reached, per-customer limit reached, or below
 * the minimum order amount. One error type with a specific message keeps the
 * API-error mapping simple (400, not a matrix of codes) — the exact failure reason
 * isn't sensitive information. */
export class CouponNotApplicableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponNotApplicableError";
  }
}

/** Thrown only at redemption time (inside the order-creation transaction) when a
 * usage-limited coupon's last unit was claimed by a concurrent checkout between
 * validation and redemption — see coupon-repository.ts `redeemAtomically`. */
export class CouponUsageLimitExceededError extends Error {
  constructor() {
    super("This coupon has just reached its usage limit. Please remove it and try again.");
    this.name = "CouponUsageLimitExceededError";
  }
}

export interface CouponPreview {
  couponId: string;
  code: string;
  discountAmount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeDiscount(
  coupon: { type: string; value: Prisma.Decimal; maxDiscountAmount: Prisma.Decimal | null },
  subtotal: number
): number {
  const value = Number(coupon.value);
  let discount = coupon.type === "PERCENTAGE" ? (subtotal * value) / 100 : value;
  if (coupon.type === "PERCENTAGE" && coupon.maxDiscountAmount !== null) {
    discount = Math.min(discount, Number(coupon.maxDiscountAmount));
  }
  // Never discount below zero or beyond the order's own subtotal.
  return round2(Math.max(0, Math.min(discount, subtotal)));
}

/** Shared eligibility checks (active/window/min-order/per-customer-limit). Usage-limit
 * is deliberately NOT checked here — that's only ever enforced by the atomic
 * conditional UPDATE in `redeemAtomically`, since a plain read here can't be trusted
 * against a concurrent redemption. */
async function assertEligible(
  coupon: Coupon,
  subtotal: number,
  userId: string | null,
  countRedemptionsForUser: (couponId: string, userId: string) => Promise<number>
): Promise<void> {
  if (!coupon.active) {
    throw new CouponNotApplicableError("This coupon is no longer active.");
  }
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new CouponNotApplicableError("This coupon is not active yet.");
  }
  if (coupon.endsAt && now > coupon.endsAt) {
    throw new CouponNotApplicableError("This coupon has expired.");
  }
  if (coupon.minOrderAmount !== null && subtotal < Number(coupon.minOrderAmount)) {
    throw new CouponNotApplicableError(
      `This coupon requires a minimum order of ${Number(coupon.minOrderAmount).toFixed(2)}.`
    );
  }
  if (coupon.usageLimit !== null && coupon.timesUsed >= coupon.usageLimit) {
    throw new CouponNotApplicableError("This coupon has reached its usage limit.");
  }
  if (coupon.perCustomerLimit !== null) {
    if (!userId) {
      throw new CouponNotApplicableError("Log in to use this coupon.");
    }
    const used = await countRedemptionsForUser(coupon.id, userId);
    if (used >= coupon.perCustomerLimit) {
      throw new CouponNotApplicableError("You've already used this coupon the maximum number of times.");
    }
  }
}

export const couponService = {
  /**
   * Validates a coupon code against the caller's cart subtotal — WITHOUT redeeming
   * it. Used for the cart/checkout "Apply" preview. Never trusts a client-supplied
   * discount amount; the returned `discountAmount` is always server-computed from
   * the live Coupon row.
   */
  async validate(code: string, subtotal: number, userId: string | null): Promise<CouponPreview> {
    const normalized = code.trim().toUpperCase();
    const coupon = await couponRepository.findByCode(normalized);
    if (!coupon) throw new CouponNotFoundError();

    await assertEligible(coupon, subtotal, userId, (couponId, uid) =>
      couponRepository.countRedemptionsForUser(couponId, uid)
    );

    return { couponId: coupon.id, code: coupon.code, discountAmount: computeDiscount(coupon, subtotal) };
  },

  /**
   * Same validation as `validate`, but reads through the caller's open transaction
   * (`tx`) for consistency with the order row about to be created — called from
   * order-service.ts `persistOrder` BEFORE the order exists (so its computed
   * `discountAmount` can be written onto the order row at creation time). Does NOT
   * consume a unit of usage — see `redeemInTransaction` for that, which runs after
   * the order row exists (CouponRedemption.orderId is required).
   */
  async previewInTransaction(
    tx: Prisma.TransactionClient,
    code: string,
    subtotal: number,
    userId: string
  ): Promise<CouponPreview> {
    const normalized = code.trim().toUpperCase();
    const coupon = await tx.coupon.findUnique({ where: { code: normalized } });
    if (!coupon) throw new CouponNotFoundError();

    await assertEligible(coupon, subtotal, userId, (couponId, uid) =>
      tx.couponRedemption.count({ where: { couponId, userId: uid } })
    );

    return { couponId: coupon.id, code: coupon.code, discountAmount: computeDiscount(coupon, subtotal) };
  },

  /**
   * Atomically consumes one unit of usage and records the redemption, inside the
   * same transaction as order creation — so a coupon redemption and its order are
   * created atomically or not at all. The conditional UPDATE in `redeemAtomically`
   * (not the earlier `previewInTransaction` read) is the actual concurrency
   * guarantee: two concurrent checkouts racing for the last unit of a limited
   * coupon can't both succeed, even though both may have passed the earlier preview.
   */
  async redeemInTransaction(
    tx: Prisma.TransactionClient,
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: number
  ): Promise<void> {
    const redeemed = await couponRepository.redeemAtomically(tx, couponId);
    if (!redeemed) throw new CouponUsageLimitExceededError();

    await couponRepository.createRedemptionTx(tx, {
      couponId,
      userId,
      orderId,
      amount: discountAmount,
    });
  },

  adminList() {
    return couponRepository.findAll();
  },

  async adminCreate(input: Parameters<typeof couponRepository.create>[0]) {
    return couponRepository.create({ ...input, code: input.code.trim().toUpperCase() });
  },

  async adminUpdate(id: string, input: Parameters<typeof couponRepository.update>[1]) {
    const existing = await couponRepository.findById(id);
    if (!existing) throw new CouponNotFoundError();
    return couponRepository.update(id, input);
  },
};
