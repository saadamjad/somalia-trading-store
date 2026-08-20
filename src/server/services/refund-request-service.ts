import { prisma } from "@/server/lib/prisma";
import {
  refundRequestRepository,
  type RefundRequestAdminListFilters,
} from "@/server/repositories/refund-request-repository";
import { orderRepository } from "@/server/repositories/order-repository";
import { notificationService } from "@/server/services/notification-service";
import type {
  RefundRequestAdminQueryInput,
  RefundRequestCreateInput,
} from "@/lib/validations/refund-request";
import type {
  OrderStatus,
  RefundReasonCategory,
  RefundRequestStatus,
} from "@/generated/prisma/client";

export class OrderNotFoundForRefundError extends Error {
  constructor() {
    super("Order not found.");
    this.name = "OrderNotFoundForRefundError";
  }
}

export class RefundRequestNotFoundError extends Error {
  constructor() {
    super("Refund request not found.");
    this.name = "RefundRequestNotFoundError";
  }
}

/**
 * Thrown when a refund is requested for an order whose status doesn't make sense for
 * a refund request — see `ELIGIBLE_ORDER_STATUSES` for the rule.
 */
export class OrderNotEligibleForRefundError extends Error {
  constructor(status: OrderStatus) {
    super(
      `Orders with status ${status} are not eligible for a refund request. ` +
        `PENDING orders can be cancelled instead; CANCELLED orders were never fulfilled.`
    );
    this.name = "OrderNotEligibleForRefundError";
  }
}

/** Thrown when the order already has an open (REQUESTED/UNDER_REVIEW) refund request. */
export class RefundRequestAlreadyOpenError extends Error {
  constructor() {
    super("This order already has an open refund request.");
    this.name = "RefundRequestAlreadyOpenError";
  }
}

export class InvalidRefundStatusTransitionError extends Error {
  constructor(from: RefundRequestStatus, to: RefundRequestStatus) {
    super(`Cannot move a refund request from ${from} to ${to}.`);
    this.name = "InvalidRefundStatusTransitionError";
  }
}

/**
 * Judgment call (Phase 10 plan leaves this open): a refund request only makes sense
 * for an order that has actually progressed past PENDING — a still-pending order can
 * just be cancelled directly (no money was ever collected to "refund"). CANCELLED
 * orders are excluded for the same reason from the other direction — they were never
 * fulfilled, so there's nothing to request a refund for. That leaves CONFIRMED /
 * PROCESSING / SHIPPED / DELIVERED as the eligible states.
 */
export const ELIGIBLE_ORDER_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
];

/**
 * Allowed transitions for `RefundRequestStatus`. REQUESTED and UNDER_REVIEW can both
 * move to APPROVED or REJECTED directly (UNDER_REVIEW is optional, not a required
 * gate); REQUESTED can also move into UNDER_REVIEW. APPROVED/REJECTED are terminal —
 * no "reopen" action in this phase.
 */
const ALLOWED_REFUND_STATUS_TRANSITIONS: Record<RefundRequestStatus, RefundRequestStatus[]> = {
  REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

function assertValidTransition(from: RefundRequestStatus, to: RefundRequestStatus): void {
  if (!ALLOWED_REFUND_STATUS_TRANSITIONS[from].includes(to)) {
    throw new InvalidRefundStatusTransitionError(from, to);
  }
}

export interface RefundRequestStatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actor: { id: string; name: string } | null;
  createdAt: string;
}

export interface RefundRequestOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
}

export interface RefundRequestView {
  id: string;
  order: RefundRequestOrderSummary;
  requestedBy: { id: string; name: string };
  reasonCategory: string;
  reasonDetail: string | null;
  status: string;
  adminNote: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  statusHistory: RefundRequestStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

interface RefundRequestRow {
  id: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    total: unknown;
    currency: string;
    userId: string;
  };
  requestedBy: { id: string; name: string };
  reasonCategory: string;
  reasonDetail: string | null;
  status: string;
  adminNote: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: Date | null;
  statusHistory: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    actor: { id: string; name: string } | null;
    createdAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

function toView(row: RefundRequestRow): RefundRequestView {
  return {
    id: row.id,
    order: {
      id: row.order.id,
      orderNumber: row.order.orderNumber,
      status: row.order.status,
      paymentStatus: row.order.paymentStatus,
      total: Number(row.order.total),
      currency: row.order.currency,
    },
    requestedBy: row.requestedBy,
    reasonCategory: row.reasonCategory,
    reasonDetail: row.reasonDetail,
    status: row.status,
    adminNote: row.adminNote,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    statusHistory: row.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      actor: h.actor,
      createdAt: h.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Customer request-a-refund + view-own-requests, and admin review — the core of Phase
 * 10. Nothing in this module ever writes to `Order.paymentStatus`; the only field it
 * ever changes on `Order` is nothing at all — refund requests are a wholly separate
 * table, related to Order only by a read-only FK (docs/IMPLEMENTATION_PLAN.md Phase 10
 * hard requirement, mirroring the Order.status/paymentStatus decoupling from Phase 9).
 */
export const refundRequestService = {
  /**
   * Creates a refund request for `orderId`, verifying that the order belongs to
   * `userId` first (ownership check lives here, not the repository — same convention
   * as order-service.ts). Throws `OrderNotFoundForRefundError` for both "doesn't
   * exist" and "belongs to someone else" (IDOR: 404, not 403 — see
   * docs/IMPLEMENTATION_PLAN.md cross-cutting standards / auth/README pattern).
   */
  async createForOwner(userId: string, input: RefundRequestCreateInput): Promise<RefundRequestView> {
    const order = await orderRepository.findByIdForUser(input.orderId, userId);
    if (!order) throw new OrderNotFoundForRefundError();

    if (!ELIGIBLE_ORDER_STATUSES.includes(order.status)) {
      throw new OrderNotEligibleForRefundError(order.status);
    }

    const existingOpen = await refundRequestRepository.findOpenForOrder(order.id);
    if (existingOpen) {
      throw new RefundRequestAlreadyOpenError();
    }

    const created = await prisma.$transaction((tx) =>
      refundRequestRepository.createTx(tx, {
        orderId: order.id,
        requestedByUserId: userId,
        reasonCategory: input.reasonCategory as RefundReasonCategory,
        reasonDetail: input.reasonDetail ? input.reasonDetail : null,
      })
    );

    return toView(created as unknown as RefundRequestRow);
  },

  /** Customer's own refund requests only. */
  async listForUser(userId: string): Promise<RefundRequestView[]> {
    const rows = await refundRequestRepository.findAllForUser(userId);
    return rows.map((r) => toView(r as unknown as RefundRequestRow));
  },

  /** Verifies ownership before returning — throws otherwise (IDOR: 404). */
  async getOwned(id: string, userId: string): Promise<RefundRequestView> {
    const row = await refundRequestRepository.findByIdForUser(id, userId);
    if (!row) throw new RefundRequestNotFoundError();
    return toView(row as unknown as RefundRequestRow);
  },

  /** Admin list — no ownership scoping; caller must have already checked `refunds.view`. */
  async adminList(query: RefundRequestAdminQueryInput): Promise<{
    items: RefundRequestView[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const filters: RefundRequestAdminListFilters = { status: query.status };
    const { items, total } = await refundRequestRepository.adminFindMany({
      filters,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      items: items.map((r) => toView(r as unknown as RefundRequestRow)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  /** Admin detail — no ownership scoping. */
  async adminGetById(id: string): Promise<RefundRequestView> {
    const row = await refundRequestRepository.adminFindById(id);
    if (!row) throw new RefundRequestNotFoundError();
    return toView(row as unknown as RefundRequestRow);
  },

  /**
   * Admin approve/reject/mark-under-review. Validates the transition, then writes the
   * new status + RefundRequestStatusHistory row + reviewedBy/reviewedAt atomically.
   * Deliberately takes no `paymentStatus` parameter and calls no order-mutating code —
   * it never touches the Order row at all. This is the one place in the codebase that
   * changes `RefundRequest.status`, and it is structurally incapable of changing
   * `Order.paymentStatus` (Phase 10 hard requirement; see the decoupling test in
   * refund-request-service.test.ts).
   */
  async updateStatus(
    id: string,
    actorId: string,
    toStatus: RefundRequestStatus,
    adminNote?: string
  ): Promise<RefundRequestView> {
    const current = await refundRequestRepository.adminFindById(id);
    if (!current) throw new RefundRequestNotFoundError();

    assertValidTransition(current.status, toStatus);

    const updated = await prisma.$transaction((tx) =>
      refundRequestRepository.updateStatusTx(tx, id, {
        fromStatus: current.status,
        toStatus,
        actorId,
        note: adminNote ? adminNote : null,
        adminNote: adminNote !== undefined ? (adminNote ? adminNote : null) : undefined,
      })
    );

    const view = toView(updated as unknown as RefundRequestRow);

    // Phase 15: notify the requesting customer only on the decisions that actually
    // matter to them (APPROVED/REJECTED) — not on the optional UNDER_REVIEW waypoint,
    // per docs/IMPLEMENTATION_PLAN.md Phase 15 ("Refund request approved/rejected").
    if (toStatus === "APPROVED" || toStatus === "REJECTED") {
      await notificationService.notify({
        userId: current.requestedByUserId,
        type: "REFUND_REQUEST_UPDATED",
        title: `Refund request ${toStatus === "APPROVED" ? "approved" : "rejected"}`,
        message: `Your refund request for order ${view.order.orderNumber} was ${toStatus.toLowerCase()}.`,
        relatedEntityType: "REFUND_REQUEST",
        relatedEntityId: view.id,
      });
    }

    return view;
  },
};
