import type { OrderStatus, PaymentStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface ShippingSnapshot {
  shippingRecipientName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2?: string | null;
  shippingCity: string;
  shippingRegion?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry: string;
}

export interface OrderItemCreateInput {
  productId: string;
  productName: string;
  sku?: string | null;
  unitPrice: Prisma.Decimal | number | string;
  quantity: number;
  lineTotal: Prisma.Decimal | number | string;
  variantId?: string | null;
  variantLabel?: string | null;
}

export interface OrderCreateInput extends ShippingSnapshot {
  orderNumber: string;
  userId: string;
  subtotal: Prisma.Decimal | number | string;
  shippingAmount: Prisma.Decimal | number | string;
  couponCode?: string | null;
  discountAmount: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
  currency: string;
  customerNote?: string | null;
  items: OrderItemCreateInput[];
}

const withItems = { items: { orderBy: { id: "asc" as const } } };
/** Customer-facing timeline read — no actor identity exposed. */
const withStatusHistory = {
  statusHistory: { orderBy: { createdAt: "asc" as const } },
};
const withCustomer = {
  user: { select: { id: true, name: true, email: true } },
};
const actorSelect = { select: { id: true, name: true } } as const;

/** Full include set for admin reads — customer, items, and both audit trails (with actor). */
const withAdminDetail = {
  ...withItems,
  ...withCustomer,
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: actorSelect },
  },
  paymentStatusHistory: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: actorSelect },
  },
};

/** Customer-facing reads: items + status timeline, no payment history/actor exposure. */
const withCustomerDetail = {
  ...withItems,
  ...withStatusHistory,
};

export interface AdminOrderListFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  /** Matches order number (partial, case-insensitive). */
  orderNumber?: string;
  /** Matches customer name or email (partial, case-insensitive). */
  customerQuery?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export type AdminOrderSortBy = "createdAt" | "total" | "orderNumber";
export type AdminOrderSortDir = "asc" | "desc";

export interface AdminOrderListOptions {
  filters: AdminOrderListFilters;
  sortBy: AdminOrderSortBy;
  sortDir: AdminOrderSortDir;
  page: number;
  pageSize: number;
}

function buildAdminWhere(filters: AdminOrderListFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (filters.status) where.status = filters.status;
  if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;

  if (filters.orderNumber) {
    where.orderNumber = { contains: filters.orderNumber, mode: "insensitive" };
  }

  if (filters.customerQuery) {
    where.user = {
      OR: [
        { name: { contains: filters.customerQuery, mode: "insensitive" } },
        { email: { contains: filters.customerQuery, mode: "insensitive" } },
      ],
    };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: filters.dateTo } : {}),
    };
  }

  return where;
}

/**
 * Data access only — Prisma queries, no business rules. Order creation is always
 * called with an explicit `tx` (an already-open `Prisma.TransactionClient`) because it
 * must compose atomically with the inventory decrement and cart clear performed
 * alongside it — see order-service.ts `createOrder`, which owns the single
 * `prisma.$transaction` these all run inside. Status/payment-status updates
 * (Phase 9) are similarly always transactional — the status field write and its
 * OrderStatusHistory/PaymentStatusHistory row are written atomically, never one
 * without the other.
 */
export const orderRepository = {
  createTx(tx: Prisma.TransactionClient, data: OrderCreateInput) {
    const { items, ...orderData } = data;
    return tx.order.create({
      data: {
        ...orderData,
        items: { create: items },
        // Phase 9: seed both audit trails with the system-authored initial row
        // (fromStatus null, actorId null) at the moment of creation — see the schema
        // comments on OrderStatusHistory/PaymentStatusHistory.
        statusHistory: { create: { fromStatus: null, toStatus: "PENDING" } },
        paymentStatusHistory: { create: { fromStatus: null, toStatus: "NOT_PAID" } },
      },
      include: withItems,
    });
  },

  findAllForUser(userId: string, status?: OrderStatus) {
    return prisma.order.findMany({
      where: { userId, ...(status ? { status } : {}) },
      include: withItems,
      orderBy: { createdAt: "desc" },
    });
  },

  /** Returns the order only if it belongs to `userId` — the ownership boundary. */
  findByIdForUser(id: string, userId: string) {
    return prisma.order.findFirst({ where: { id, userId }, include: withCustomerDetail });
  },

  findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({ where: { orderNumber }, include: withItems });
  },

  /**
   * Used by review-service.ts to compute `Review.verifiedPurchase` server-side — true
   * only if this user has a DELIVERED order containing this product. Minimal `select`
   * (no full item/customer includes) since only existence matters here.
   */
  async hasDeliveredOrderWithProduct(userId: string, productId: string): Promise<boolean> {
    const match = await prisma.order.findFirst({
      where: { userId, status: "DELIVERED", items: { some: { productId } } },
      select: { id: true },
    });
    return match !== null;
  },

  /** Admin list: no ownership scoping — the route/service layer enforces `orders.view`. */
  async adminFindMany(options: AdminOrderListOptions) {
    const where = buildAdminWhere(options.filters);
    const skip = (options.page - 1) * options.pageSize;

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { ...withCustomer, _count: { select: { items: true } } },
        orderBy: { [options.sortBy]: options.sortDir },
        skip,
        take: options.pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, total };
  },

  /** Admin detail: full order, items, customer, and both audit trails. */
  adminFindById(id: string) {
    return prisma.order.findUnique({ where: { id }, include: withAdminDetail });
  },

  /**
   * Writes the new `status` and its OrderStatusHistory row in one call, inside `tx`
   * (an already-open transaction — see order-service.ts `updateStatus`, which owns the
   * `prisma.$transaction`). Never touches `paymentStatus` — see the hard requirement in
   * docs/IMPLEMENTATION_PLAN.md Phase 9 and order-service.ts.
   */
  updateStatusTx(
    tx: Prisma.TransactionClient,
    orderId: string,
    data: { fromStatus: OrderStatus; toStatus: OrderStatus; actorId: string; note?: string | null }
  ) {
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: data.toStatus,
        statusHistory: {
          create: {
            fromStatus: data.fromStatus,
            toStatus: data.toStatus,
            actorId: data.actorId,
            note: data.note ?? null,
          },
        },
      },
      include: withAdminDetail,
    });
  },

  updateInternalNote(id: string, internalNote: string | null) {
    return prisma.order.update({
      where: { id },
      data: { internalNote },
      include: withAdminDetail,
    });
  },
};
