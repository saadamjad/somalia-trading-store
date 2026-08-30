import type { Coupon, CouponType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface CouponCreateInput {
  code: string;
  type: CouponType;
  value: Prisma.Decimal | number | string;
  minOrderAmount?: Prisma.Decimal | number | string | null;
  maxDiscountAmount?: Prisma.Decimal | number | string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  active?: boolean;
}

export type CouponUpdateInput = Partial<CouponCreateInput>;

/** Data access only — validation/pricing logic lives in coupon-service.ts. */
export const couponRepository = {
  findByCode(code: string) {
    return prisma.coupon.findUnique({ where: { code } });
  },

  findById(id: string) {
    return prisma.coupon.findUnique({ where: { id } });
  },

  findAll() {
    return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  },

  create(data: CouponCreateInput) {
    return prisma.coupon.create({ data });
  },

  update(id: string, data: CouponUpdateInput) {
    return prisma.coupon.update({ where: { id }, data });
  },

  countRedemptionsForUser(couponId: string, userId: string) {
    return prisma.couponRedemption.count({ where: { couponId, userId } });
  },

  /**
   * Atomically increments `Coupon.timesUsed`, but ONLY if doing so doesn't exceed
   * `usageLimit` — a single conditional UPDATE, not a read-then-write, so two
   * concurrent checkouts racing for the last unit of a limited coupon can't both
   * succeed. Returns null if the limit would be exceeded (caller treats that as
   * "coupon no longer available"), same contract as inventoryRepository.applyAdjustment.
   */
  async redeemAtomically(tx: Prisma.TransactionClient, couponId: string): Promise<Coupon | null> {
    const rows = await tx.$queryRaw<Coupon[]>`
      UPDATE "Coupon"
      SET "timesUsed" = "timesUsed" + 1, "updatedAt" = now()
      WHERE "id" = ${couponId} AND ("usageLimit" IS NULL OR "timesUsed" < "usageLimit")
      RETURNING *
    `;
    return rows.length > 0 ? rows[0] : null;
  },

  createRedemptionTx(
    tx: Prisma.TransactionClient,
    data: { couponId: string; userId: string; orderId: string; amount: Prisma.Decimal | number | string }
  ) {
    return tx.couponRedemption.create({ data });
  },
};
