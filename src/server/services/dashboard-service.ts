import type { OrderStatus, RefundRequestStatus, QuoteStatus } from "@/generated/prisma/client";
import { dashboardRepository } from "@/server/repositories/dashboard-repository";
import { inventoryService } from "@/server/services/inventory-service";
import type { DashboardPeriod } from "@/lib/validations/dashboard";

const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const REFUND_STATUSES: RefundRequestStatus[] = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
];

const QUOTE_STATUSES: QuoteStatus[] = [
  "NEW",
  "REVIEWING",
  "QUOTED",
  "ACCEPTED",
  "DECLINED",
  "CONVERTED",
];

/**
 * Maps a period preset to its start instant, relative to `now`. `null` means "all
 * time" — no lower bound. `today` is midnight-to-now in server local time; that's a
 * deliberate simplification (no per-admin timezone preference exists anywhere else in
 * this codebase either) rather than a UTC-day boundary, since "today" read by an admin
 * viewing the dashboard should match their own clock as closely as the server allows.
 */
export function periodStart(period: DashboardPeriod, now: Date = new Date()): Date | null {
  switch (period) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}

function zeroCountRecord<K extends string>(keys: K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function fillCounts<K extends string>(
  keys: K[],
  rows: { status: K; count: number }[]
): Record<K, number> {
  const record = zeroCountRecord(keys);
  for (const row of rows) {
    record[row.status] = row.count;
  }
  return record;
}

export interface DashboardSummary {
  period: DashboardPeriod;
  /** ISO timestamp, or null for "all time" (no lower bound). */
  periodStart: string | null;
  periodEnd: string;
  orders: {
    /** Current counts by status — an operational snapshot ("what needs attention right
     * now"), not scoped to the selected period. */
    byStatus: Record<OrderStatus, number>;
    totalAllTime: number;
    newInPeriod: number;
    /** Sum of `Order.total` for orders created within the period. This is order
     * VALUE — the total of orders placed — NOT revenue or money collected. No payment
     * gateway exists yet (D-007); every order's paymentStatus is NOT_PAID. Never
     * relabel this as "Revenue" anywhere it's displayed. */
    orderValueInPeriod: number;
    currency: string;
  };
  customers: {
    total: number;
    newInPeriod: number;
  };
  products: {
    total: number;
    featured: number;
  };
  inventory: {
    lowStock: number;
    outOfStock: number;
  };
  refunds: {
    byStatus: Record<RefundRequestStatus, number>;
    /** REQUESTED count — refund requests awaiting a first review. */
    needingAttention: number;
  };
  quotes: {
    byStatus: Record<QuoteStatus, number>;
    /** NEW count — quotes awaiting an admin response. */
    needingResponse: number;
  };
}

/**
 * Aggregates existing data (orders, customers, products, inventory, refund requests,
 * quotes) into one operational overview for `/admin`. This is Phase 13's dashboard —
 * "what needs my attention right now + basic counts", not analytics/charts/exports
 * (that's Phase 14). Reuses `inventoryService.getAll()` (Phase 5's existing low-stock
 * query logic) rather than reimplementing stock-status classification here; every other
 * count comes from `dashboardRepository`, a thin layer of `groupBy`/`count`/`aggregate`
 * calls (see its file comment for why those don't already exist elsewhere).
 *
 * No permission check here — matches this codebase's convention (permission checks
 * live at the route/page, not the service); see `/api/admin/dashboard` and
 * `/admin/page.tsx`.
 */
export const dashboardService = {
  async getSummary(period: DashboardPeriod, now: Date = new Date()): Promise<DashboardSummary> {
    const since = periodStart(period, now);

    const [
      orderStatusRows,
      ordersTotalAllTime,
      ordersNewInPeriod,
      orderValueInPeriod,
      customersTotal,
      customersNewInPeriod,
      productsTotal,
      productsFeatured,
      inventoryRows,
      refundStatusRows,
      quoteStatusRows,
    ] = await Promise.all([
      dashboardRepository.orderStatusCounts(),
      dashboardRepository.ordersCountAllTime(),
      dashboardRepository.ordersCountInPeriod(since),
      dashboardRepository.orderValueInPeriod(since),
      dashboardRepository.customersCountTotal(),
      dashboardRepository.customersCountInPeriod(since),
      dashboardRepository.productsCountTotal(),
      dashboardRepository.productsCountFeatured(),
      inventoryService.getAll(),
      dashboardRepository.refundRequestStatusCounts(),
      dashboardRepository.quoteStatusCounts(),
    ]);

    const ordersByStatus = fillCounts(ORDER_STATUSES, orderStatusRows);
    const refundsByStatus = fillCounts(REFUND_STATUSES, refundStatusRows);
    const quotesByStatus = fillCounts(QUOTE_STATUSES, quoteStatusRows);

    const lowStock = inventoryRows.filter((row) => row.status === "low_stock").length;
    const outOfStock = inventoryRows.filter((row) => row.status === "out_of_stock").length;

    return {
      period,
      periodStart: since ? since.toISOString() : null,
      periodEnd: now.toISOString(),
      orders: {
        byStatus: ordersByStatus,
        totalAllTime: ordersTotalAllTime,
        newInPeriod: ordersNewInPeriod,
        orderValueInPeriod,
        currency: "USD",
      },
      customers: {
        total: customersTotal,
        newInPeriod: customersNewInPeriod,
      },
      products: {
        total: productsTotal,
        featured: productsFeatured,
      },
      inventory: {
        lowStock,
        outOfStock,
      },
      refunds: {
        byStatus: refundsByStatus,
        needingAttention: refundsByStatus.REQUESTED,
      },
      quotes: {
        byStatus: quotesByStatus,
        needingResponse: quotesByStatus.NEW,
      },
    };
  },
};
