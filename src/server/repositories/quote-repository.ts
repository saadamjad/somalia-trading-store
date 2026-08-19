import type { Prisma, QuoteStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface QuoteItemCreateData {
  productId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  requestedPrice?: number | null;
  customerNote?: string | null;
}

export interface QuoteCreateData {
  userId?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  contactCompany?: string | null;
  customerNote?: string | null;
  currency: string;
  items: QuoteItemCreateData[];
}

const actorSelect = { select: { id: true, name: true } } as const;

const withStatusHistory = {
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    include: { actor: actorSelect },
  },
};

const withItems = { items: { orderBy: { id: "asc" as const } } };

/** Full include set for both customer and admin reads — view-shaping (if any is ever
 * needed) is a service-layer concern, same convention as refund-request-repository.ts. */
const withDetail = {
  ...withItems,
  ...withStatusHistory,
  user: { select: { id: true, name: true, email: true } },
  convertedOrder: { select: { id: true, orderNumber: true } },
};

export interface QuoteAdminListFilters {
  status?: QuoteStatus;
}

export interface QuoteAdminListOptions {
  filters: QuoteAdminListFilters;
  page: number;
  pageSize: number;
}

/**
 * Data access only — Prisma queries, no business rules, no permission checks. Mirrors
 * refund-request-repository.ts's structure/conventions.
 */
export const quoteRepository = {
  createTx(tx: Prisma.TransactionClient, data: QuoteCreateData) {
    return tx.quote.create({
      data: {
        userId: data.userId ?? null,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone ?? null,
        contactCompany: data.contactCompany ?? null,
        customerNote: data.customerNote ?? null,
        currency: data.currency,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku ?? null,
            quantity: item.quantity,
            requestedPrice: item.requestedPrice ?? null,
            customerNote: item.customerNote ?? null,
          })),
        },
        // System-authored initial row: fromStatus null, no actor — the submitter
        // (guest or customer) is creating their own quote, not an admin acting on it.
        statusHistory: { create: { fromStatus: null, toStatus: "NEW" } },
      },
      include: withDetail,
    });
  },

  /** Customer's own quotes only — newest first. Guest quotes have no owning userId and
   * are therefore never returned here (no session to scope them by — see Quote's
   * schema comment on the guest-conversion limitation). */
  findAllForUser(userId: string) {
    return prisma.quote.findMany({
      where: { userId },
      include: withDetail,
      orderBy: { createdAt: "desc" },
    });
  },

  /** Returns the quote only if it belongs to `userId` — the ownership boundary. */
  findByIdForUser(id: string, userId: string) {
    return prisma.quote.findFirst({ where: { id, userId }, include: withDetail });
  },

  /** Admin list: no ownership scoping — the route/service layer enforces `quotes.view`. */
  async adminFindMany(options: QuoteAdminListOptions) {
    const where: Prisma.QuoteWhereInput = {};
    if (options.filters.status) where.status = options.filters.status;

    const skip = (options.page - 1) * options.pageSize;

    const [items, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: withDetail,
        orderBy: { createdAt: "desc" },
        skip,
        take: options.pageSize,
      }),
      prisma.quote.count({ where }),
    ]);

    return { items, total };
  },

  adminFindById(id: string) {
    return prisma.quote.findUnique({ where: { id }, include: withDetail });
  },

  findByIdTx(tx: Prisma.TransactionClient, id: string) {
    return tx.quote.findUnique({ where: { id }, include: withDetail });
  },

  /**
   * Admin pricing response: sets `quotedUnitPrice` on each named item, moves the quote
   * to QUOTED, and writes the QuoteStatusHistory row atomically. Every `items[].id`
   * must already belong to this quote — quote-service.ts `respond` validates that
   * before calling this (a mismatched id would otherwise throw a Prisma "record not
   * found" error deep in the nested write, which is correct-but-unhelpful; the service
   * layer turns that into a clear `QuoteItemMismatchError` first).
   */
  respondTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: {
      items: { id: string; quotedUnitPrice: number }[];
      fromStatus: QuoteStatus;
      actorId: string;
      adminNote?: string | null;
    }
  ) {
    return tx.quote.update({
      where: { id },
      data: {
        status: "QUOTED",
        adminNote: data.adminNote !== undefined ? data.adminNote : undefined,
        items: {
          update: data.items.map((item) => ({
            where: { id: item.id },
            data: { quotedUnitPrice: item.quotedUnitPrice },
          })),
        },
        statusHistory: {
          create: { fromStatus: data.fromStatus, toStatus: "QUOTED", actorId: data.actorId },
        },
      },
      include: withDetail,
    });
  },

  /**
   * Plain status transition (REVIEWING / ACCEPTED / DECLINED) — no item pricing
   * involved. `actorId` is null for a customer acting on their own quote (see
   * QuoteStatusHistory's schema comment) and set for every admin-initiated transition.
   */
  updateStatusTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: { fromStatus: QuoteStatus; toStatus: QuoteStatus; actorId?: string | null; note?: string | null }
  ) {
    return tx.quote.update({
      where: { id },
      data: {
        status: data.toStatus,
        statusHistory: {
          create: {
            fromStatus: data.fromStatus,
            toStatus: data.toStatus,
            actorId: data.actorId ?? null,
            note: data.note ?? null,
          },
        },
      },
      include: withDetail,
    });
  },

  /**
   * Marks the quote CONVERTED and links `convertedOrderId`, inside `tx` — the SAME
   * transaction as the Order's creation (see order-service.ts
   * `createOrderFromPricedItems`'s `withinTransaction` hook, invoked from
   * quote-service.ts `convertToOrder`). This is what guarantees a converted quote and
   * its resulting order can never disagree about whether conversion happened.
   */
  markConvertedTx(
    tx: Prisma.TransactionClient,
    id: string,
    data: { fromStatus: QuoteStatus; orderId: string; actorId: string }
  ) {
    return tx.quote.update({
      where: { id },
      data: {
        status: "CONVERTED",
        convertedOrderId: data.orderId,
        statusHistory: {
          create: { fromStatus: data.fromStatus, toStatus: "CONVERTED", actorId: data.actorId },
        },
      },
      include: withDetail,
    });
  },
};
