import { prisma } from "@/server/lib/prisma";

/**
 * Data access only — Prisma queries, no business rules. Phase 13's dashboard is a
 * read-only aggregation view, so this repository is deliberately small: a handful of
 * `groupBy`/`count`/`aggregate` calls that don't already exist as a reusable method on
 * an existing repository (order/refund-request/quote/product repositories are list-
 * shaped, not count-by-status-shaped). Where an existing service already exposes the
 * right aggregate (e.g. inventory low-stock/out-of-stock), the service layer calls
 * that directly instead of duplicating it here — see dashboard-service.ts.
 */
export const dashboardRepository = {
  async orderStatusCounts() {
    const rows = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },

  ordersCountAllTime() {
    return prisma.order.count();
  },

  ordersCountInPeriod(since: Date | null) {
    return prisma.order.count({ where: since ? { createdAt: { gte: since } } : undefined });
  },

  /** Sum of `Order.total` for orders created within the period — an order VALUE
   * total, not a revenue/payment-collected figure (see docs/DECISIONS.md D-007; every
   * order has `paymentStatus: NOT_PAID` regardless of status, so this must never be
   * labeled or treated as money actually received). */
  async orderValueInPeriod(since: Date | null) {
    const result = await prisma.order.aggregate({
      where: since ? { createdAt: { gte: since } } : undefined,
      _sum: { total: true },
    });
    return Number(result._sum.total ?? 0);
  },

  customersCountTotal() {
    return prisma.user.count({ where: { role: { name: "customer" } } });
  },

  customersCountInPeriod(since: Date | null) {
    return prisma.user.count({
      where: {
        role: { name: "customer" },
        ...(since ? { createdAt: { gte: since } } : {}),
      },
    });
  },

  productsCountTotal() {
    return prisma.product.count();
  },

  productsCountFeatured() {
    return prisma.product.count({ where: { featured: true } });
  },

  async refundRequestStatusCounts() {
    const rows = await prisma.refundRequest.groupBy({ by: ["status"], _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },

  async quoteStatusCounts() {
    const rows = await prisma.quote.groupBy({ by: ["status"], _count: { _all: true } });
    return rows.map((row) => ({ status: row.status, count: row._count._all }));
  },
};
