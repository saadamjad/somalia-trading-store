import type { Prisma, RefundReasonCategory, RefundRequestStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface RefundRequestCreateData {
  orderId: string;
  requestedByUserId: string;
  reasonCategory: RefundReasonCategory;
  reasonDetail?: string | null;
}

const withOrder = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      total: true,
      currency: true,
      userId: true,
    },
  },
};

const actorSelect = { select: { id: true, name: true } } as const;

const withStatusHistory = {
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: actorSelect },
  },
};

/** Full include set for both customer and admin reads — see refund-service.ts for the
 * view-shaping that decides what a customer vs. an admin actually gets to see (the
 * repository always returns everything; visibility is a service-layer concern). */
const withDetail = {
  ...withOrder,
  ...withStatusHistory,
  requestedBy: actorSelect,
  reviewedBy: actorSelect,
};

export interface RefundRequestAdminListFilters {
  status?: RefundRequestStatus;
}

export interface RefundRequestAdminListOptions {
  filters: RefundRequestAdminListFilters;
  page: number;
  pageSize: number;
}

/**
 * Data access only — Prisma queries, no business rules, no permission checks. Mirrors
 * order-repository.ts's structure/conventions.
 */
export const refundRequestRepository = {
  createTx(tx: Prisma.TransactionClient, data: RefundRequestCreateData) {
    return tx.refundRequest.create({
      data: {
        orderId: data.orderId,
        requestedByUserId: data.requestedByUserId,
        reasonCategory: data.reasonCategory,
        reasonDetail: data.reasonDetail ?? null,
        // System-authored initial row: fromStatus null, no actor (the customer is
        // creating their own request, not an admin acting on someone else's) — same
        // pattern as OrderStatusHistory's seed row at order creation.
        statusHistory: { create: { fromStatus: null, toStatus: "REQUESTED" } },
      },
      include: withDetail,
    });
  },

  /** Any open (REQUESTED/UNDER_REVIEW) request for this order, if one exists. */
  findOpenForOrder(orderId: string) {
    return prisma.refundRequest.findFirst({
      where: { orderId, status: { in: ["REQUESTED", "UNDER_REVIEW"] } },
    });
  },

  /** Customer's own refund requests only — newest first. */
  findAllForUser(userId: string) {
    return prisma.refundRequest.findMany({
      where: { requestedByUserId: userId },
      include: withDetail,
      orderBy: { createdAt: "desc" },
    });
  },

  /** Returns the request only if it was made by `userId` — the ownership boundary. */
  findByIdForUser(id: string, userId: string) {
    return prisma.refundRequest.findFirst({
      where: { id, requestedByUserId: userId },
      include: withDetail,
    });
  },

  /** Admin list: no ownership scoping — the route/service layer enforces `refunds.view`. */
  async adminFindMany(options: RefundRequestAdminListOptions) {
    const where: Prisma.RefundRequestWhereInput = {};
    if (options.filters.status) where.status = options.filters.status;

    const skip = (options.page - 1) * options.pageSize;

    const [items, total] = await Promise.all([
      prisma.refundRequest.findMany({
        where,
        include: withDetail,
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.refundRequest.count({ where }),
    ]);

    return { items, total };
  },

  adminFindById(id: string) {
    return prisma.refundRequest.findUnique({ where: { id }, include: withDetail });
  },

  /**
   * Writes the new `status`, `adminNote`, `reviewedByUserId`/`reviewedAt`, and the
   * RefundRequestStatusHistory row atomically, inside `tx` (an already-open
   * transaction — see refund-service.ts `updateStatus`). Deliberately has no
   * parameter, and touches no column, related to `Order.paymentStatus` — this is the
   * one place that changes `RefundRequest.status`, and it is structurally incapable of
   * also changing `Order.paymentStatus` (Phase 10 hard requirement).
   */
  updateStatusTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: {
      fromStatus: RefundRequestStatus;
      toStatus: RefundRequestStatus;
      actorId: string;
      note?: string | null;
      adminNote?: string | null;
    }
  ) {
    return tx.refundRequest.update({
      where: { id },
      data: {
        status: data.toStatus,
        adminNote: data.adminNote !== undefined ? data.adminNote : undefined,
        reviewedByUserId: data.actorId,
        reviewedAt: new Date(),
        statusHistory: {
          create: {
            fromStatus: data.fromStatus,
            toStatus: data.toStatus,
            actorId: data.actorId,
            note: data.note ?? null,
          },
        },
      },
      include: withDetail,
    });
  },
};
