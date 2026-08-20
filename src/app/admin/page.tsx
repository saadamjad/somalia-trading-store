import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { dashboardService } from "@/server/services/dashboard-service";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_LABELS,
  dashboardQuerySchema,
  type DashboardPeriod,
} from "@/lib/validations/dashboard";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "Dashboard | Admin" };

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const REFUND_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const QUOTE_STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  QUOTED: "Quoted",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  CONVERTED: "Converted",
};

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function StatTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  tone?: "default" | "warning";
}) {
  const body = (
    <Card className={tone === "warning" ? "border-destructive" : undefined}>
      <CardContent className="p-5">
        <p className="label mb-1 text-muted">{label}</p>
        <p className="font-display text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

function StatusBreakdown({
  counts,
  labels,
  hrefFor,
}: {
  counts: Record<string, number>;
  labels: Record<string, string>;
  hrefFor: (status: string) => string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {Object.entries(counts).map(([status, count]) => (
        <li key={status}>
          <Link
            href={hrefFor(status)}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-accent-muted"
          >
            <span>{labels[status] ?? status}</span>
            <Badge variant="secondary">{count}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Admin dashboard — Phase 13. Gated on `products.view`, the same stand-in permission
 * `/admin/layout.tsx` uses for "can enter the admin area at all" (this dashboard
 * summarizes every resource type, so it doesn't map cleanly to one narrower
 * permission — see the layout's own comment for the reasoning this follows).
 *
 * This is an operational overview ("what needs attention right now + basic counts"),
 * not analytics/charts/exports — that's Phase 14. The order-value figure shown here is
 * explicitly the total VALUE of orders placed in the period, never "Revenue" — no
 * payment gateway exists yet (docs/DECISIONS.md D-007), so every order's paymentStatus
 * is NOT_PAID and no money has actually been collected.
 */
export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("products.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">
          Your account does not have permission to view the admin dashboard.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const { period } = dashboardQuerySchema.parse({ period: params.period });

  const summary = await dashboardService.getSummary(period);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted">Operational overview of the store right now.</p>
        </div>
        <nav aria-label="Period" className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {DASHBOARD_PERIODS.map((p) => (
            <PeriodLink key={p} period={p} active={p === period} />
          ))}
        </nav>
      </div>

      <section aria-labelledby="orders-heading" className="flex flex-col gap-4">
        <h2 id="orders-heading" className="label text-muted">
          Orders — {DASHBOARD_PERIOD_LABELS[period]}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="New orders in period" value={summary.orders.newInPeriod} href="/admin/orders" />
          <StatTile
            label="Order value in period (not revenue — no payments collected)"
            value={formatPrice(summary.orders.orderValueInPeriod, summary.orders.currency)}
            href="/admin/orders"
          />
          <StatTile label="Total orders (all time)" value={summary.orders.totalAllTime} href="/admin/orders" />
          <StatTile
            label="Pending orders"
            value={summary.orders.byStatus.PENDING}
            href="/admin/orders?status=PENDING"
            tone={summary.orders.byStatus.PENDING > 0 ? "warning" : "default"}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by status (current)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <StatusBreakdown
              counts={summary.orders.byStatus}
              labels={ORDER_STATUS_LABEL}
              hrefFor={(status) => `/admin/orders?status=${status}`}
            />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="attention-heading" className="flex flex-col gap-4">
        <h2 id="attention-heading" className="label text-muted">
          Needs attention
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile
            label="Refund requests to review"
            value={summary.refunds.needingAttention}
            href="/admin/refunds?status=REQUESTED"
            tone={summary.refunds.needingAttention > 0 ? "warning" : "default"}
          />
          <StatTile
            label="Quotes awaiting response"
            value={summary.quotes.needingResponse}
            href="/admin/quotes?status=NEW"
            tone={summary.quotes.needingResponse > 0 ? "warning" : "default"}
          />
          <StatTile
            label="Low stock products"
            value={summary.inventory.lowStock}
            href="/admin/inventory"
            tone={summary.inventory.lowStock > 0 ? "warning" : "default"}
          />
          <StatTile
            label="Out of stock products"
            value={summary.inventory.outOfStock}
            href="/admin/inventory"
            tone={summary.inventory.outOfStock > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      <section aria-labelledby="catalog-heading" className="grid gap-4 md:grid-cols-3">
        <div>
          <h2 id="catalog-heading" className="label mb-4 text-muted">
            Catalog & customers
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Total products" value={summary.products.total} href="/admin/products" />
            <StatTile label="Featured products" value={summary.products.featured} href="/admin/products" />
            <StatTile label="Total customers" value={summary.customers.total} />
            <StatTile
              label={`New customers (${DASHBOARD_PERIOD_LABELS[period]})`}
              value={summary.customers.newInPeriod}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Refund requests by status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <StatusBreakdown
              counts={summary.refunds.byStatus}
              labels={REFUND_STATUS_LABEL}
              hrefFor={(status) => `/admin/refunds?status=${status}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quotes by status</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <StatusBreakdown
              counts={summary.quotes.byStatus}
              labels={QUOTE_STATUS_LABEL}
              hrefFor={(status) => `/admin/quotes?status=${status}`}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PeriodLink({ period, active }: { period: DashboardPeriod; active: boolean }) {
  return (
    <Link
      href={period === "30d" ? "/admin" : `/admin?period=${period}`}
      className={
        active
          ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-accent-muted"
      }
      aria-current={active ? "page" : undefined}
    >
      {DASHBOARD_PERIOD_LABELS[period]}
    </Link>
  );
}
