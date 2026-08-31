import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
 * Admin dashboard — Phase 13. Gated on `dashboard.view` (Admin User Management &
 * RBAC pass), a dedicated permission distinct from `products.view` — the dashboard
 * summarizes order-value/financial figures across the whole store, so "can see the
 * product catalog" must not accidentally double as "can see store-wide money
 * figures." Roles that lack `dashboard.view` (e.g. `staff`) are redirected to
 * `/admin/products` instead of shown an Access Denied wall as their first landing
 * screen after login — same security outcome, better first impression.
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

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("dashboard.view")) {
    redirect("/admin/products");
  }

  const params = await searchParams;
  const { period } = dashboardQuerySchema.parse({ period: params.period });

  const summary = await dashboardService.getSummary(period);
  const t = await getTranslations("admin.dashboard");

  const ORDER_STATUS_LABEL: Record<string, string> = {
    PENDING: t("orderStatus.pending"),
    CONFIRMED: t("orderStatus.confirmed"),
    PROCESSING: t("orderStatus.processing"),
    SHIPPED: t("orderStatus.shipped"),
    DELIVERED: t("orderStatus.delivered"),
    CANCELLED: t("orderStatus.cancelled"),
  };

  const REFUND_STATUS_LABEL: Record<string, string> = {
    REQUESTED: t("refundStatus.requested"),
    UNDER_REVIEW: t("refundStatus.underReview"),
    APPROVED: t("refundStatus.approved"),
    REJECTED: t("refundStatus.rejected"),
  };

  const QUOTE_STATUS_LABEL: Record<string, string> = {
    NEW: t("quoteStatus.new"),
    REVIEWING: t("quoteStatus.reviewing"),
    QUOTED: t("quoteStatus.quoted"),
    ACCEPTED: t("quoteStatus.accepted"),
    DECLINED: t("quoteStatus.declined"),
    CONVERTED: t("quoteStatus.converted"),
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <nav aria-label="Period" className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {DASHBOARD_PERIODS.map((p) => (
            <PeriodLink key={p} period={p} active={p === period} />
          ))}
        </nav>
      </div>

      <section aria-labelledby="orders-heading" className="flex flex-col gap-4">
        <h2 id="orders-heading" className="label text-muted">
          {t("ordersHeading", { period: DASHBOARD_PERIOD_LABELS[period] })}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label={t("newOrdersInPeriod")} value={summary.orders.newInPeriod} href="/admin/orders" />
          <StatTile
            label={t("orderValueInPeriod")}
            value={formatPrice(summary.orders.orderValueInPeriod, summary.orders.currency)}
            href="/admin/orders"
          />
          <StatTile label={t("totalOrdersAllTime")} value={summary.orders.totalAllTime} href="/admin/orders" />
          <StatTile
            label={t("pendingOrders")}
            value={summary.orders.byStatus.PENDING}
            href="/admin/orders?status=PENDING"
            tone={summary.orders.byStatus.PENDING > 0 ? "warning" : "default"}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("ordersByStatus")}</CardTitle>
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
          {t("needsAttention")}
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile
            label={t("refundRequestsToReview")}
            value={summary.refunds.needingAttention}
            href="/admin/refunds?status=REQUESTED"
            tone={summary.refunds.needingAttention > 0 ? "warning" : "default"}
          />
          <StatTile
            label={t("quotesAwaitingResponse")}
            value={summary.quotes.needingResponse}
            href="/admin/quotes?status=NEW"
            tone={summary.quotes.needingResponse > 0 ? "warning" : "default"}
          />
          <StatTile
            label={t("lowStockProducts")}
            value={summary.inventory.lowStock}
            href="/admin/inventory"
            tone={summary.inventory.lowStock > 0 ? "warning" : "default"}
          />
          <StatTile
            label={t("outOfStockProducts")}
            value={summary.inventory.outOfStock}
            href="/admin/inventory"
            tone={summary.inventory.outOfStock > 0 ? "warning" : "default"}
          />
        </div>
      </section>

      <section aria-labelledby="catalog-heading" className="grid gap-4 md:grid-cols-3">
        <div>
          <h2 id="catalog-heading" className="label mb-4 text-muted">
            {t("catalogAndCustomers")}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <StatTile label={t("totalProducts")} value={summary.products.total} href="/admin/products" />
            <StatTile label={t("featuredProducts")} value={summary.products.featured} href="/admin/products" />
            <StatTile label={t("totalCustomers")} value={summary.customers.total} />
            <StatTile
              label={t("newCustomers", { period: DASHBOARD_PERIOD_LABELS[period] })}
              value={summary.customers.newInPeriod}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("refundRequestsByStatus")}</CardTitle>
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
            <CardTitle className="text-base">{t("quotesByStatus")}</CardTitle>
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
          ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-foreground"
          : "rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-accent-muted"
      }
      aria-current={active ? "page" : undefined}
    >
      {DASHBOARD_PERIOD_LABELS[period]}
    </Link>
  );
}
