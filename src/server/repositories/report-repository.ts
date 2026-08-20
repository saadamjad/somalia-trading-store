import { prisma } from "@/server/lib/prisma";
import type { OrderStatus, RefundRequestStatus, QuoteStatus } from "@/generated/prisma/client";

/**
 * Data access only — Prisma queries for Phase 14's reports. Order/refund/quote list
 * reads reuse the existing admin repositories where their filter shape already covers
 * what a report needs (see report-service.ts); the aggregation queries here (sales-by-
 * product, orders-by-customer, all-products inventory transactions) don't exist
 * anywhere else in the codebase, so they're added here rather than bolted onto an
 * unrelated repository.
 */
export const reportRepository = {
  /** Every OrderItem within the date range, grouped by product, summed by quantity and
   * line value. `orderStatus` optionally narrows to one order status (e.g. exclude
   * CANCELLED orders from a sales report) — omitted means every status. */
  async productSales(params: { dateFrom?: Date; dateTo?: Date; orderStatus?: OrderStatus }) {
    const rows = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          ...(params.orderStatus ? { status: params.orderStatus } : {}),
          createdAt: buildDateFilter(params.dateFrom, params.dateTo),
        },
      },
      _sum: { quantity: true, lineTotal: true },
      _count: { _all: true },
    });

    if (rows.length === 0) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: rows.map((row) => row.productId) } },
      select: { id: true, name: true, sku: true, currency: true, category: { select: { name: true } } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    return rows
      .map((row) => {
        const product = productById.get(row.productId);
        return {
          productId: row.productId,
          productName: product?.name ?? "(deleted product)",
          sku: product?.sku ?? null,
          category: product?.category.name ?? null,
          currency: product?.currency ?? "USD",
          quantitySold: row._sum.quantity ?? 0,
          orderLineCount: row._count._all,
          totalValue: Number(row._sum.lineTotal ?? 0),
        };
      })
      .sort((a, b) => b.quantitySold - a.quantitySold);
  },

  /** Every Order within the date range, grouped by customer, counted and summed by
   * `Order.total` (order VALUE — see report-service.ts for the "not revenue" caveat
   * that must travel with this figure everywhere it's displayed/exported). */
  async ordersByCustomer(params: { dateFrom?: Date; dateTo?: Date }) {
    const rows = await prisma.order.groupBy({
      by: ["userId"],
      where: { createdAt: buildDateFilter(params.dateFrom, params.dateTo) },
      _count: { _all: true },
      _sum: { total: true },
    });

    if (rows.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.userId) } },
      select: { id: true, name: true, email: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    return rows
      .map((row) => {
        const user = userById.get(row.userId);
        return {
          customerId: row.userId,
          customerName: user?.name ?? "(deleted customer)",
          customerEmail: user?.email ?? "",
          orderCount: row._count._all,
          orderValue: Number(row._sum.total ?? 0),
        };
      })
      .sort((a, b) => b.orderValue - a.orderValue);
  },

  /** Recent inventory transactions across every product (not scoped to one product,
   * unlike `inventoryRepository.listTransactionsForProduct`), optionally date-ranged. */
  listAllTransactions(params: { dateFrom?: Date; dateTo?: Date; limit?: number }) {
    return prisma.inventoryTransaction.findMany({
      where: { createdAt: buildDateFilter(params.dateFrom, params.dateTo) },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 500,
    });
  },

  refundRequestStatusCounts() {
    return prisma.refundRequest.groupBy({ by: ["status"], _count: { _all: true } });
  },

  quoteStatusCounts() {
    return prisma.quote.groupBy({ by: ["status"], _count: { _all: true } });
  },
};

function buildDateFilter(dateFrom?: Date, dateTo?: Date) {
  if (!dateFrom && !dateTo) return undefined;
  return {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {}),
  };
}

export type { OrderStatus, RefundRequestStatus, QuoteStatus };
