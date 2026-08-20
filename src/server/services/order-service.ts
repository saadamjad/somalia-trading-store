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
import { cartService, type StockIssue } from "@/server/services/cart-service";
import { addressService } from "@/server/services/address-service";
import { inventoryService } from "@/server/services/inventory-service";
import { notificationService } from "@/server/services/notification-service";
import type {
  OrderAdminQueryInput,
  OrderCreateInput,
} from "@/lib/validations/order";
import type { Order, OrderItem, OrderStatus, Prisma } from "@/generated/prisma/client";

export type { ShippingSnapshot };

export class EmptyCartError extends Error {
  constructor() {
    super("Your cart is empty — add items before checking out.");
    this.name = "EmptyCartError";
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

interface PersistOrderItemInput {
  productId: string;
  productName: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface PersistOrderParams {
  userId: string;
  shipping: ShippingSnapshot;
  currency: string;
  customerNote: string | null;
  orderItemsInput: PersistOrderItemInput[];
  /** Clears the caller's server cart, inside the same transaction, once the order is
   * created — only ever true for the normal cart-based checkout path. */
  clearCart: boolean;
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
  // No tax/shipping charges are calculated (D-008, deferred) — total equals subtotal
  // today. Kept as a separate field so tax/shipping can be added later without a
  // breaking schema change.
  const total = subtotal;

  const MAX_ORDER_NUMBER_ATTEMPTS = 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      return await prisma.$transaction(async (tx) => {
        // Decrement stock for every line FIRST, inside this same transaction — the
        // atomic conditional UPDATE inside inventoryService.adjustStock (passed this
        // `tx`, not a new one) throws InsufficientStockError if stock changed since the
        // pre-check the caller already ran, which aborts and rolls back the whole
        // transaction.
        for (const item of params.orderItemsInput) {
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

        const order = await orderRepository.createTx(tx, {
          orderNumber,
          userId: params.userId,
          subtotal,
          total,
          currency: params.currency,
          customerNote: params.customerNote,
          ...params.shipping,
          items: params.orderItemsInput,
        });

        // Cart is cleared only here, inside the same transaction as order creation —
        // if anything above throws, this line never runs and the cart is untouched.
        if (params.clearCart) {
          const cart = await cartRepository.findByUserIdTx(tx, params.userId);
          if (cart) {
            await cartRepository.clearItemsTx(tx, cart.id);
          }
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

    const productIds = cartItems.map((item) => item.productId);
    const products = await productRepository.findByIds(productIds);
    const productById = new Map(products.map((p) => [p.id, p]));

    const missing = cartItems.filter((item) => !productById.has(item.productId));
    if (missing.length > 0) {
      // A cart item referencing a product that no longer exists is functionally the
      // same as "0 available" from the customer's point of view.
      throw new StockUnavailableError(
        missing.map((item) => ({ productId: item.productId, requested: item.quantity, available: 0 }))
      );
    }

    const currency = products[0]?.currency ?? "USD";

    const orderItemsInput = cartItems.map((item) => {
      const product = productById.get(item.productId)!;
      const unitPrice = Number(product.price);
      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku ?? null,
        unitPrice,
        quantity: item.quantity,
        lineTotal,
      };
    });

    const customerNote = input.customerNote ? input.customerNote : null;

    const created = await persistOrder({
      userId,
      shipping,
      currency,
      customerNote,
      orderItemsInput,
      clearCart: true,
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
