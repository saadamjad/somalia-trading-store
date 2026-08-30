import { createHash } from "node:crypto";
import { prisma } from "@/server/lib/prisma";
import {
  orderRepository,
  type ShippingSnapshot,
  type AdminOrderListFilters,
  type AdminOrderSortBy,
  type AdminOrderSortDir,
} from "@/server/repositories/order-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { cartRepository } from "@/server/repositories/cart-repository";
import { checkoutLockRepository } from "@/server/repositories/checkout-lock-repository";
import { cartService, type StockIssue } from "@/server/services/cart-service";
import { addressService } from "@/server/services/address-service";
import { inventoryService } from "@/server/services/inventory-service";
import { couponService } from "@/server/services/coupon-service";
import { productVariantService, variantLabel } from "@/server/services/product-variant-service";
import { productVariantRepository } from "@/server/repositories/product-variant-repository";
import { notificationService } from "@/server/services/notification-service";
import { userRepository, roleRepository } from "@/server/repositories/user-repository";
import type {
  OrderAdminQueryInput,
  OrderCreateInput,
  GuestOrderCreateInput,
} from "@/lib/validations/order";
import type { Order, OrderItem, OrderStatus, Prisma } from "@/generated/prisma/client";

export type { ShippingSnapshot };

// Flat-rate shipping (D-008 resolved): free shipping on every order, business decision
// confirmed 2026-08-30. Not sourced from an env var — this is a business-configured
// constant, not environment-specific config; change it here if the business changes
// its shipping policy.
const FLAT_SHIPPING_AMOUNT = 0;

export class EmptyCartError extends Error {
  constructor() {
    super("Your cart is empty — add items before checking out.");
    this.name = "EmptyCartError";
  }
}

/**
 * Thrown when a checkout request's server cart is unexpectedly already empty at the
 * moment the order-creation transaction actually runs — the signal that a CONCURRENT
 * duplicate submission (double-click, browser back+resubmit, retried request) for the
 * same cart already won the race and created an order. Found via adversarial
 * red-team testing: firing two simultaneous POST /api/orders for the same
 * authenticated cart previously created TWO separate orders (both succeeded, both
 * decremented inventory) — the cart was read once outside any transaction and reused
 * by both concurrent requests, and nothing detected that the cart had already been
 * consumed. See `persistOrder`'s cart-clear-first ordering for the fix.
 */
export class DuplicateCheckoutError extends Error {
  constructor() {
    super("This order may have already been placed. Please check your order history before retrying.");
    this.name = "DuplicateCheckoutError";
  }
}

/** Thrown when one or more cart lines can't be fulfilled at their requested quantity. */
export class StockUnavailableError extends Error {
  issues: StockIssue[];
  constructor(issues: StockIssue[]) {
    super("One or more items in your cart are no longer available in the requested quantity.");
    this.name = "StockUnavailableError";
    this.issues = issues;
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
    this.name = "OrderNotFoundError";
  }
}

/**
 * Thrown when a guest checkout's email belongs to an existing, real (non-guest)
 * account. Guest checkout has no password check — silently attaching the order to
 * that account would let anyone place an order "as" another user just by typing
 * their email. See order-service.ts `createGuestOrder`.
 */
export class EmailBelongsToExistingAccountError extends Error {
  constructor() {
    super("An account already exists with this email. Please log in to continue.");
    this.name = "EmailBelongsToExistingAccountError";
  }
}

/**
 * Thrown when a requested order-status transition isn't in `ALLOWED_STATUS_TRANSITIONS`
 * — see the map's own comment for the rules being enforced.
 */
export class InvalidStatusTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot move an order from ${from} to ${to}.`);
    this.name = "InvalidStatusTransitionError";
  }
}

/**
 * Phase 9: a lightweight allowed-transitions map, not a full state-machine library —
 * "a simple allowed-transitions map is enough" per docs/IMPLEMENTATION_PLAN.md Phase 9.
 * Rules encoded here:
 *  - Forward-only through the normal lifecycle (PENDING → CONFIRMED → PROCESSING →
 *    SHIPPED → DELIVERED); no skipping ahead (e.g. PENDING straight to DELIVERED) and
 *    no moving backward once advanced.
 *  - CANCELLED is reachable from any non-terminal state (an order can be cancelled at
 *    any point before it ships/delivers) but is itself terminal — nothing transitions
 *    out of CANCELLED.
 *  - DELIVERED is terminal — nothing transitions out of it either.
 *  - A no-op "transition" (same status to itself) is also rejected by the check below;
 *    it's never in any state's allowed-set.
 * This is deliberately independent of `paymentStatus` — no entry here reads or writes
 * that field, and no future entry should.
 */
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ALLOWED_STATUS_TRANSITIONS[from].includes(to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

export interface OrderItemView {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  variantId: string | null;
  variantLabel: string | null;
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  shipping: {
    recipientName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;
  };
  subtotal: number;
  shippingAmount: number;
  couponCode: string | null;
  discountAmount: number;
  total: number;
  currency: string;
  customerNote: string | null;
  items: OrderItemView[];
  createdAt: string;
  updatedAt: string;
}

/** Customer-facing status timeline entry — no actor identity, no internal note. */
export interface OrderStatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
}

export interface OrderDetailView extends OrderView {
  statusHistory: OrderStatusHistoryEntry[];
}

export interface AdminOrderStatusHistoryEntry extends OrderStatusHistoryEntry {
  note: string | null;
  actor: { id: string; name: string } | null;
}

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  customer: { id: string; name: string; email: string };
  itemCount: number;
  createdAt: string;
}

export interface AdminOrderListResult {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOrderDetailView extends OrderView {
  customer: { id: string; name: string; email: string };
  internalNote: string | null;
  statusHistory: AdminOrderStatusHistoryEntry[];
  paymentStatusHistory: AdminOrderStatusHistoryEntry[];
}

type OrderWithItems = Order & { items: OrderItem[] };

function toOrderView(order: OrderWithItems): OrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    shipping: {
      recipientName: order.shippingRecipientName,
      phone: order.shippingPhone,
      line1: order.shippingLine1,
      line2: order.shippingLine2,
      city: order.shippingCity,
      region: order.shippingRegion,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    subtotal: Number(order.subtotal),
    shippingAmount: Number(order.shippingAmount),
    couponCode: order.couponCode,
    discountAmount: Number(order.discountAmount),
    total: Number(order.total),
    currency: order.currency,
    customerNote: order.customerNote,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
      variantId: item.variantId,
      variantLabel: item.variantLabel,
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

interface HistoryRow {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: Date;
}

function toStatusHistoryEntry(row: HistoryRow): OrderStatusHistoryEntry {
  return {
    id: row.id,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAdminStatusHistoryEntry(
  row: HistoryRow & { actor: { id: string; name: string } | null }
): AdminOrderStatusHistoryEntry {
  return {
    ...toStatusHistoryEntry(row),
    note: row.note,
    actor: row.actor,
  };
}

function normalizeInline(value?: string): string | null {
  return value ? value : null;
}

export function shippingFromAddress(address: {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
}): ShippingSnapshot {
  return {
    shippingRecipientName: address.recipientName,
    shippingPhone: address.phone,
    shippingLine1: address.line1,
    shippingLine2: address.line2,
    shippingCity: address.city,
    shippingRegion: address.region,
    shippingPostalCode: address.postalCode,
    shippingCountry: address.country,
  };
}

export function shippingFromInline(input: NonNullable<OrderCreateInput["shippingAddress"]>): ShippingSnapshot {
  return {
    shippingRecipientName: input.recipientName,
    shippingPhone: input.phone,
    shippingLine1: input.line1,
    shippingLine2: normalizeInline(input.line2),
    shippingCity: input.city,
    shippingRegion: normalizeInline(input.region),
    shippingPostalCode: normalizeInline(input.postalCode),
    shippingCountry: input.country,
  };
}

/**
 * Fallback idempotency key for a `clearCart: false` checkout that didn't supply its
 * own `idempotencyKey` (e.g. a direct API caller bypassing the checkout UI). Buckets
 * by a hash of the order's content (recipient/address/items/coupon) AND a coarse
 * 5-second time window: identical content submitted twice within the same bucket
 * collides (caught as a duplicate); the SAME content submitted again a few seconds
 * later — indistinguishable from a genuinely repeated legitimate purchase without a
 * real per-attempt key — is allowed through, same tradeoff explained in the
 * CheckoutLock model's schema comment. This is strictly a fallback: the real
 * checkout UI always sends a proper per-page-load key (see checkout-form.tsx), which
 * has no such ambiguity.
 */
function deriveFallbackIdempotencyKey(params: PersistOrderParams): string {
  const contentParts = [
    params.userId,
    params.shipping.shippingRecipientName,
    params.shipping.shippingLine1,
    params.shipping.shippingCity,
    params.shipping.shippingCountry,
    params.couponCode ?? "",
    ...params.orderItemsInput.map((i) => `${i.productId}:${i.variantId ?? ""}:${i.quantity}`).sort(),
  ];
  const contentHash = createHash("sha256").update(contentParts.join("|")).digest("hex");
  const timeBucket = Math.floor(Date.now() / 5000);
  return `fallback:${contentHash}:${timeBucket}`;
}

function generateOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${datePart}-${randPart}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Shared cart-line -> order-item pricing resolution, used by both `createOrder`
 * (authenticated, server cart) and `createGuestOrder` (client-supplied item list) so
 * the variant-pricing logic exists in exactly one place. Re-reads every product AND
 * variant from the DB — never trusts a client-supplied price — and throws
 * `StockUnavailableError` (treated as "0 available") for any line whose product or
 * variant no longer exists, same as a plain missing-product line did before variants
 * existed.
 */
async function resolveCartItemsToOrderInput(
  items: { productId: string; variantId?: string | null; quantity: number }[]
): Promise<{
  products: Awaited<ReturnType<typeof productRepository.findByIds>>;
  orderItemsInput: PersistOrderItemInput[];
}> {
  const productIds = items.map((item) => item.productId);
  const variantIds = items.filter((item) => item.variantId).map((item) => item.variantId!);

  const [products, variants] = await Promise.all([
    productRepository.findByIds(productIds),
    productVariantRepository.findByIds(variantIds),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const variantById = new Map(variants.map((v) => [v.id, v]));

  const missing = items.filter((item) => {
    if (!productById.has(item.productId)) return true;
    if (item.variantId) {
      const variant = variantById.get(item.variantId);
      // A mismatched pairing (variant belongs to a DIFFERENT product than the cart
      // line's own productId) is treated the same as "doesn't exist" — never trust
      // the caller's (productId, variantId) pairing. Without this check, a
      // buggy/malicious client could produce an OrderItem whose snapshotted
      // SKU/label/price belong to a different product than the one it's billed
      // against. See cart-service.ts's `assertVariantBelongsToProduct` for the same
      // guard on the cart-write path — this is the authoritative check, since both
      // createOrder (server cart) and createGuestOrder (client-supplied items, which
      // never touches cart-service at all) funnel through here.
      if (!variant || variant.productId !== item.productId) return true;
    }
    return false;
  });
  if (missing.length > 0) {
    // A cart item referencing a product/variant that no longer exists (or a variant
    // that doesn't belong to the stated product) is functionally the same as "0
    // available" from the customer's point of view.
    throw new StockUnavailableError(
      missing.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        requested: item.quantity,
        available: 0,
      }))
    );
  }

  const orderItemsInput: PersistOrderItemInput[] = items.map((item) => {
    const product = productById.get(item.productId)!;
    const variant = item.variantId ? variantById.get(item.variantId)! : null;
    const unitPrice = variant?.price !== null && variant?.price !== undefined
      ? Number(variant.price)
      : Number(product.price);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    return {
      productId: product.id,
      productName: product.name,
      sku: variant?.sku ?? product.sku ?? null,
      unitPrice,
      quantity: item.quantity,
      lineTotal,
      variantId: variant?.id ?? null,
      variantLabel: variant ? variantLabel(variant.attributes as Record<string, string>) : null,
    };
  });

  return { products, orderItemsInput };
}

interface PersistOrderItemInput {
  productId: string;
  productName: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  variantId?: string | null;
  variantLabel?: string | null;
}

interface PersistOrderParams {
  userId: string;
  shipping: ShippingSnapshot;
  currency: string;
  customerNote: string | null;
  orderItemsInput: PersistOrderItemInput[];
  /** Optional coupon code to apply — re-validated and redeemed atomically inside the
   * same transaction as order creation (see couponService.previewInTransaction /
   * redeemInTransaction). Never trusted for its discount amount — only the code. */
  couponCode?: string | null;
  /** Clears the caller's server cart, inside the same transaction, once the order is
   * created — only ever true for the normal cart-based checkout path. */
  clearCart: boolean;
  /** Only consulted when `clearCart` is false (guest checkout, quote conversion) —
   * see the CheckoutLock model's schema comment. Ignored for the cart-checkout path,
   * which has its own, more precise guard (the cart's own row count). */
  idempotencyKey?: string | null;
  /** Runs inside the SAME transaction as order creation + inventory decrement, right
   * after the order row is created — e.g. quote-service.ts uses this to atomically
   * mark a Quote CONVERTED + link the resulting order, so a quote conversion can never
   * leave a created Order whose quote still looks unconverted, or vice versa. */
  withinTransaction?: (tx: Prisma.TransactionClient, order: OrderWithItems) => Promise<void>;
}

/**
 * Shared order-persistence core — the safety-critical transaction pattern used by
 * BOTH `createOrder` (normal cart checkout, Phase 8) and `createOrderFromPricedItems`
 * (quote-to-order conversion, Phase 11). Runs order creation + inventory decrement +
 * (optionally) cart clear + (optionally) a caller-supplied side effect all in ONE
 * Prisma `$transaction`: if anything fails (insufficient stock discovered at the
 * atomic decrement, a DB error, an order-number collision), everything rolls back —
 * no partial order, no wrongly-decremented inventory, no side effect without its order.
 *
 * `status`/`paymentStatus` are hardcoded to PENDING/NOT_PAID by `orderRepository.createTx`
 * — see docs/DECISIONS.md D-007. Nothing here (or anywhere else in this phase) can
 * produce any other value.
 */
async function persistOrder(params: PersistOrderParams): Promise<OrderWithItems> {
  const subtotal =
    Math.round(params.orderItemsInput.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
  // Flat-rate shipping (D-008 resolved) — currently free ($0) for every order. No
  // tax calculation exists (still deferred). Kept as its own field so a future
  // zone/carrier-based calculation can replace FLAT_SHIPPING_AMOUNT without a
  // breaking schema change — see docs/DECISIONS.md.
  const shippingAmount = FLAT_SHIPPING_AMOUNT;

  const MAX_ORDER_NUMBER_ATTEMPTS = 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      return await prisma.$transaction(async (tx) => {
        // Duplicate-checkout guard — MUST run first, before any inventory decrement or
        // order creation.
        //
        // The concurrency guarantee is the same "atomic conditional operation, not a
        // read-then-write" principle as inventory/coupons elsewhere in this file: two
        // simultaneous checkout requests for the same cart (a double-click, a
        // back-button resubmit, a retried request) both call `DELETE FROM CartItem
        // WHERE cartId = X` here. Postgres serializes the two DELETEs against the same
        // rows — the second one blocks until the first commits, then re-evaluates its
        // WHERE clause and finds nothing left to delete (`count === 0`), which is the
        // signal that another concurrent request already consumed this cart and
        // created its order. That loser transaction throws and rolls back entirely —
        // its inventory decrement (which hasn't happened yet, since this runs first)
        // never occurs, so a duplicate submission costs nothing.
        //
        // Found via adversarial red-team testing: before this guard, two simultaneous
        // checkout requests for the same cart both succeeded and created two separate
        // orders, both decrementing inventory.
        if (params.clearCart) {
          const cart = await cartRepository.findByUserIdTx(tx, params.userId);
          if (!cart) {
            throw new EmptyCartError();
          }
          const { count } = await cartRepository.clearItemsTx(tx, cart.id);
          if (count === 0) {
            throw new DuplicateCheckoutError();
          }
        } else {
          // Guest checkout and quote-to-order conversion have no server Cart row to
          // gate on (`clearCart: false`) — the SAME adversarial testing pass found
          // this left them unprotected: a RETURNING guest (an existing isGuest User
          // row, reused across orders — see createGuestOrder) double-clicking checkout
          // could create two separate orders, since a brand-new guest email was only
          // accidentally protected by an unrelated unique-constraint collision on user
          // creation. `checkoutLockRepository.claim` is a second, independent atomic
          // gate keyed to `(params.userId, key)` — see the CheckoutLock model's schema
          // comment for why its `INSERT ... ON CONFLICT ... DO NOTHING` shape is what
          // makes it race-proof (a plain `INSERT ... WHERE NOT EXISTS` would not be),
          // and why a per-attempt key (not a time window) is the only correct way to
          // tell "the same click, retried" apart from "a genuinely repeated purchase."
          const key = params.idempotencyKey ?? deriveFallbackIdempotencyKey(params);
          const claimed = await checkoutLockRepository.claim(tx, params.userId, key);
          if (!claimed) {
            throw new DuplicateCheckoutError();
          }
        }

        // Decrement stock for every line FIRST, inside this same transaction — the
        // atomic conditional UPDATE inside inventoryService.adjustStock/
        // productVariantService.adjustStock (passed this `tx`, not a new one) throws
        // InsufficientStockError/VariantInsufficientStockError if stock changed since
        // the pre-check the caller already ran, which aborts and rolls back the whole
        // transaction. A variant line decrements ONLY its variant's stock, never the
        // parent product's (they're separate rows — see ProductVariant's schema
        // comment on why this is a parallel inventory path).
        for (const item of params.orderItemsInput) {
          if (item.variantId) {
            await productVariantService.adjustStock(
              {
                variantId: item.variantId,
                delta: -item.quantity,
                reason: "ORDER_PLACED",
                actorId: params.userId,
                note: `Order ${orderNumber}`,
              },
              tx
            );
          } else {
            await inventoryService.adjustStock(
              {
                productId: item.productId,
                delta: -item.quantity,
                reason: "ORDER_PLACED",
                actorId: params.userId,
                note: `Order ${orderNumber}`,
              },
              tx
            );
          }
        }

        // Coupon: previewed (not yet redeemed) BEFORE the order row exists, using
        // this same `tx` for read consistency — see couponService.previewInTransaction.
        // `discountAmount` must be known before creating the order row since `total`
        // depends on it; actual redemption (the atomic usage-limit guarantee) happens
        // AFTER the order exists, since CouponRedemption.orderId is required.
        let couponId: string | null = null;
        let couponCode: string | null = null;
        let discountAmount = 0;
        if (params.couponCode) {
          const preview = await couponService.previewInTransaction(
            tx,
            params.couponCode,
            subtotal,
            params.userId
          );
          couponId = preview.couponId;
          couponCode = preview.code;
          discountAmount = preview.discountAmount;
        }
        const total = Math.round((subtotal + shippingAmount - discountAmount) * 100) / 100;

        const order = await orderRepository.createTx(tx, {
          orderNumber,
          userId: params.userId,
          subtotal,
          shippingAmount,
          couponCode,
          discountAmount,
          total,
          currency: params.currency,
          customerNote: params.customerNote,
          ...params.shipping,
          items: params.orderItemsInput,
        });

        // Redemption happens only now that order.id exists. If the coupon's usage
        // limit was just claimed by a concurrent checkout (between the preview above
        // and this atomic UPDATE), this throws and rolls back the ENTIRE transaction
        // — order creation and inventory decrement included — never a half-applied
        // coupon or an order that silently lost its discount.
        if (couponId) {
          await couponService.redeemInTransaction(tx, couponId, params.userId, order.id, discountAmount);
        }

        if (params.withinTransaction) {
          await params.withinTransaction(tx, order);
        }

        return order;
      });
    } catch (error) {
      lastError = error;
      if (isUniqueConstraintError(error)) {
        // orderNumber collision — vanishingly unlikely, but retry with a fresh one
        // rather than surfacing a confusing 500 to the customer.
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to create order after multiple attempts.");
}

export interface PricedOrderItemInput {
  productId: string;
  productName: string;
  sku?: string | null;
  unitPrice: number;
  quantity: number;
}

export interface CreateOrderFromPricedItemsParams {
  userId: string;
  items: PricedOrderItemInput[];
  shipping: ShippingSnapshot;
  currency: string;
  customerNote?: string | null;
  /** Passed through to persistOrder's duplicate-checkout guard (`clearCart: false`
   * path) — quote-service.ts passes the quote's own id, which is naturally stable
   * and unique per conversion attempt: re-converting the SAME quote should always be
   * treated as a duplicate, and the quote's own ACCEPTED->CONVERTED status transition
   * already ensures a given quote is only ever the source of one conversion params
   * object per call anyway. */
  idempotencyKey?: string | null;
  withinTransaction?: (tx: Prisma.TransactionClient, order: OrderWithItems) => Promise<void>;
}

export const orderService = {
  /**
   * Order creation — the normal Phase 8 cart checkout path. Given a session-verified
   * `userId` and a shipping choice (an owned address id or an inline address), this:
   *
   *  1. Resolves the shipping snapshot (never a live Address FK — see schema.prisma).
   *  2. Loads the user's server-side cart — the ONLY source of "what's being ordered".
   *     No API surface here accepts a client-supplied product list, price, or quantity;
   *     see src/lib/validations/order.ts.
   *  3. Validates stock via cartService.validateStock (reused from Phase 7, not
   *     reimplemented) and re-prices every line from the current Product rows.
   *  4. Delegates to `persistOrder` for the actual atomic creation.
   */
  async createOrder(userId: string, input: OrderCreateInput): Promise<OrderView> {
    const shipping = input.addressId
      ? shippingFromAddress(await addressService.getOwned(input.addressId, userId))
      : shippingFromInline(input.shippingAddress!);

    const cartItems = await cartService.getCartForUser(userId);
    if (cartItems.length === 0) {
      throw new EmptyCartError();
    }

    const stockIssues = await cartService.validateStock(cartItems);
    if (stockIssues.length > 0) {
      throw new StockUnavailableError(stockIssues);
    }

    const { products, orderItemsInput } = await resolveCartItemsToOrderInput(cartItems);
    const currency = products[0]?.currency ?? "USD";

    const customerNote = input.customerNote ? input.customerNote : null;

    const created = await persistOrder({
      userId,
      shipping,
      currency,
      customerNote,
      orderItemsInput,
      couponCode: input.couponCode ? input.couponCode : null,
      clearCart: true,
    });

    return toOrderView(created);
  },

  /**
   * Guest checkout: no session required. The client's cart lives only in
   * localStorage for a guest (cart-store.ts), so `input.items` — not a server Cart
   * row — is the source of "what's being ordered". Still re-prices every line from
   * the current Product rows and re-checks stock server-side, exactly like the
   * authenticated path — the only difference is where the item list comes from.
   *
   * Finds-or-creates a `User` row by email so `Order.userId` (a required FK, not
   * nullable — see schema.prisma) has somewhere to point: an existing account is
   * reused as-is (so a returning guest, or someone who already registered with this
   * email, doesn't get a duplicate/shadow account); a brand-new email gets a
   * password-less `isGuest: true` account. That account can't log in until a real
   * password is set via the normal forgot-password flow (auth-service.ts
   * `verifyCredentials` already rejects a null passwordHash).
   */
  async createGuestOrder(input: GuestOrderCreateInput): Promise<OrderView> {
    const email = input.email.trim().toLowerCase();

    let user = await userRepository.findByEmail(email);
    if (user) {
      // A real (non-guest) account already owns this email — guest checkout has no
      // password check, so silently attaching the order here would let anyone place
      // an order "as" that account just by typing its email. Reject instead of
      // reusing it; a returning GUEST (isGuest: true, e.g. ordered before without
      // ever setting a password) is fine to reuse, since no real account is impersonated.
      if (!user.isGuest) {
        throw new EmailBelongsToExistingAccountError();
      }
    } else {
      const customerRole = await roleRepository.findByName("customer");
      if (!customerRole) {
        throw new Error("The 'customer' role is not seeded. Run `npx prisma db seed`.");
      }
      user = await userRepository.create({
        name: input.name,
        email,
        passwordHash: null,
        roleId: customerRole.id,
        isGuest: true,
      });
    }

    // Dedupe by (productId, variantId) line identity (summing quantities) — unlike
    // the authenticated path, `input.items` is client-supplied with no DB-level
    // uniqueness constraint behind it (a guest has no Cart row). Without this, a
    // duplicated line would silently create two OrderItem rows instead of one
    // combined line — same reasoning as cart-service.ts's `lineKey`.
    const itemsByLine = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
    for (const item of input.items) {
      const variantId = item.variantId ?? null;
      const key = `${item.productId}::${variantId ?? ""}`;
      const existing = itemsByLine.get(key);
      itemsByLine.set(key, {
        productId: item.productId,
        variantId,
        quantity: (existing?.quantity ?? 0) + item.quantity,
      });
    }
    const dedupedItems = Array.from(itemsByLine.values());

    const stockIssues = await cartService.validateStock(dedupedItems);
    if (stockIssues.length > 0) {
      throw new StockUnavailableError(stockIssues);
    }

    const { products, orderItemsInput } = await resolveCartItemsToOrderInput(dedupedItems);
    const currency = products[0]?.currency ?? "USD";

    const created = await persistOrder({
      userId: user.id,
      shipping: shippingFromInline(input.shippingAddress),
      currency,
      customerNote: input.customerNote ? input.customerNote : null,
      orderItemsInput,
      couponCode: input.couponCode ? input.couponCode : null,
      clearCart: false,
      idempotencyKey: input.idempotencyKey ? input.idempotencyKey : null,
    });

    return toOrderView(created);
  },

  /**
   * Quote-to-order conversion's order-creation call (Phase 11) — see
   * quote-service.ts `convertToOrder`, the only caller. Composes with the SAME
   * `persistOrder` transaction pattern as `createOrder` (atomic inventory decrement +
   * order creation), just sourced from pre-priced quote items instead of a cart, and
   * with no cart to clear. `withinTransaction` lets the caller atomically mark the
   * source Quote CONVERTED in the same DB transaction as the Order's creation.
   */
  async createOrderFromPricedItems(params: CreateOrderFromPricedItemsParams): Promise<OrderView> {
    const orderItemsInput = params.items.map((item) => {
      const lineTotal = Math.round(item.unitPrice * item.quantity * 100) / 100;
      return {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku ?? null,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const created = await persistOrder({
      userId: params.userId,
      shipping: params.shipping,
      currency: params.currency,
      customerNote: params.customerNote ? params.customerNote : null,
      orderItemsInput,
      clearCart: false,
      idempotencyKey: params.idempotencyKey,
      withinTransaction: params.withinTransaction,
    });

    return toOrderView(created);
  },

  /** Optional `status` filter — customer's own order history, `/account/orders`. */
  async listForUser(userId: string, status?: OrderStatus): Promise<OrderView[]> {
    const orders = await orderRepository.findAllForUser(userId, status);
    return orders.map(toOrderView);
  },

  /**
   * Verifies ownership before returning — throws `OrderNotFoundError` otherwise.
   * Includes the status timeline (no actor identity, no internal note — see
   * `OrderStatusHistoryEntry`) for the customer-facing order-detail view.
   */
  async getOwned(id: string, userId: string): Promise<OrderDetailView> {
    const order = await orderRepository.findByIdForUser(id, userId);
    if (!order) throw new OrderNotFoundError();
    return {
      ...toOrderView(order),
      statusHistory: order.statusHistory.map(toStatusHistoryEntry),
    };
  },

  /**
   * Admin order list — search/filter/sort/paginate across ALL orders, not scoped to
   * any one customer. Callers (the `/api/admin/orders` route) must have already
   * verified `orders.view` — this method performs no permission check itself, matching
   * the rest of the service layer's convention (permission checks live at the route,
   * ownership checks live in the service).
   */
  async adminList(query: OrderAdminQueryInput): Promise<AdminOrderListResult> {
    const filters: AdminOrderListFilters = {
      status: query.status,
      paymentStatus: query.paymentStatus,
      orderNumber: query.orderNumber,
      customerQuery: query.customer,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };

    const sortBy: AdminOrderSortBy = query.sortBy;
    const sortDir: AdminOrderSortDir = query.sortDir;

    const { items, total } = await orderRepository.adminFindMany({
      filters,
      sortBy,
      sortDir,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      items: items.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: Number(order.total),
        currency: order.currency,
        customer: order.user,
        itemCount: order._count.items,
        createdAt: order.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  /** Admin order detail — no ownership scoping; full audit trails and internal note. */
  async adminGetById(id: string): Promise<AdminOrderDetailView> {
    const order = await orderRepository.adminFindById(id);
    if (!order) throw new OrderNotFoundError();
    return {
      ...toOrderView(order),
      customer: order.user,
      internalNote: order.internalNote,
      statusHistory: order.statusHistory.map(toAdminStatusHistoryEntry),
      paymentStatusHistory: order.paymentStatusHistory.map(toAdminStatusHistoryEntry),
    };
  },

  /**
   * Admin status update — the core of Phase 9's "status update control". Validates the
   * transition against `ALLOWED_STATUS_TRANSITIONS`, then writes the new status and its
   * OrderStatusHistory row atomically (one `prisma.$transaction`, via
   * `orderRepository.updateStatusTx`). Deliberately takes no `paymentStatus` parameter
   * and touches no payment-related column — this is the one place in the codebase that
   * changes `Order.status`, and it is structurally incapable of also changing
   * `Order.paymentStatus` (spec §5 hard requirement; see also the decoupling test in
   * order-service.test.ts).
   */
  async updateStatus(
    orderId: string,
    actorId: string,
    toStatus: OrderStatus,
    note?: string
  ): Promise<AdminOrderDetailView> {
    const current = await orderRepository.adminFindById(orderId);
    if (!current) throw new OrderNotFoundError();

    assertValidTransition(current.status, toStatus);

    const updated = await prisma.$transaction((tx) =>
      orderRepository.updateStatusTx(tx, orderId, {
        fromStatus: current.status,
        toStatus,
        actorId,
        note: note ? note : null,
      })
    );

    // Phase 15: notify the order's customer — in-app (real) + stubbed email "would
    // send" log (D-011). Runs after the status-change transaction has committed; a
    // notification failure must never roll back or block the actual status update.
    await notificationService.notify({
      userId: updated.userId,
      type: "ORDER_STATUS_CHANGED",
      title: `Order ${updated.orderNumber} status updated`,
      message: `Your order ${updated.orderNumber} is now ${toStatus}.`,
      relatedEntityType: "ORDER",
      relatedEntityId: updated.id,
    });

    return {
      ...toOrderView(updated),
      customer: updated.user,
      internalNote: updated.internalNote,
      statusHistory: updated.statusHistory.map(toAdminStatusHistoryEntry),
      paymentStatusHistory: updated.paymentStatusHistory.map(toAdminStatusHistoryEntry),
    };
  },

  /** Admin-only working note — see `Order.internalNote`'s schema comment. */
  async updateInternalNote(orderId: string, internalNote: string): Promise<AdminOrderDetailView> {
    const existing = await orderRepository.adminFindById(orderId);
    if (!existing) throw new OrderNotFoundError();

    const updated = await orderRepository.updateInternalNote(orderId, internalNote ? internalNote : null);

    return {
      ...toOrderView(updated),
      customer: updated.user,
      internalNote: updated.internalNote,
      statusHistory: updated.statusHistory.map(toAdminStatusHistoryEntry),
      paymentStatusHistory: updated.paymentStatusHistory.map(toAdminStatusHistoryEntry),
    };
  },
};
