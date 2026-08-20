import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { reportService } from "@/server/services/report-service";
import {
  REPORT_TYPES,
  REPORT_TYPE_LABELS,
  EXPORT_FORMATS,
  reportQuerySchema,
  type ReportType,
} from "@/lib/validations/reports";
import { OrderStatus, RefundRequestStatus, QuoteStatus } from "@/generated/prisma/client";

export const metadata = { title: "Reports | Admin" };

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Single flexible reports page (Phase 14) — a report-type selector (tabs) over one
 * shared table/filter/export UI, rather than six bespoke pages, per the plan's "keep
 * it consistent, not over-engineered" guidance. Gated on `reports.view`.
 *
 * Order VALUE totals shown/exported here are the sum of `Order.total` — never
 * "Revenue": no payment gateway exists yet (docs/DECISIONS.md D-007), every order has
 * paymentStatus NOT_PAID. This label discipline matches the Phase 13 dashboard.
 */
export default async function AdminReportsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/reports");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("reports.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view reports.</p>
      </div>
    );
  }

  const rawParams = await searchParams;
  // Empty-string values from unselected <select>/<input> filters are treated as
  // "not provided" rather than fed into zod validation (which would reject an empty
  // string against, e.g., a native enum and fail the whole query).
  const cleaned = Object.fromEntries(
    Object.entries(rawParams).filter(([, v]) => v !== undefined && v !== "")
  );
  const parsed = reportQuerySchema.safeParse(cleaned);
  const query = parsed.success ? parsed.data : reportQuerySchema.parse({});

  const table = await reportService.build(query);

  function buildHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { ...rawParams, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    return `/admin/reports?${params.toString()}`;
  }

  function exportHref(format: string) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (value) params.set(key, value);
    }
    params.set("type", query.type);
    params.set("format", format);
    return `/api/admin/reports/export?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted">
          Data reports derived from live store records, exportable as CSV, XLSX, or PDF.
        </p>
      </div>

      <nav aria-label="Report type" className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {REPORT_TYPES.map((type) => (
          <Link
            key={type}
            href={buildHref({ type, dateFrom: undefined, dateTo: undefined, orderStatus: undefined, customer: undefined, stockStatus: undefined, refundStatus: undefined, quoteStatus: undefined })}
            aria-current={type === query.type ? "page" : undefined}
            className={
              type === query.type
                ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-accent-muted"
            }
          >
            {REPORT_TYPE_LABELS[type]}
          </Link>
        ))}
      </nav>

      <FilterForm type={query.type} rawParams={rawParams} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          {table.summary.map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface px-4 py-2">
              <p className="text-xs text-muted">{item.label}</p>
              <p className="font-display text-lg font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {EXPORT_FORMATS.map((format) => (
            <Button key={format} asChild variant="outline" size="sm">
              <a href={exportHref(format)}>Export {format.toUpperCase()}</a>
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              {table.columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {table.columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}>
                    {String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {table.rows.length === 0 && (
              <tr>
                <td colSpan={table.columns.length} className="px-4 py-8 text-center text-muted">
                  No data matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterForm({
  type,
  rawParams,
}: {
  type: ReportType;
  rawParams: Record<string, string | undefined>;
}) {
  const showOrderStatus = type === "orders" || type === "products";
  const showCustomer = type === "orders";
  const showStockStatus = type === "inventory";
  const showRefundStatus = type === "refunds";
  const showQuoteStatus = type === "quotes";

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 border border-border bg-surface p-4">
      <input type="hidden" name="type" value={type} />

      <div>
        <label htmlFor="dateFrom" className="mb-1 block text-xs font-medium text-muted">
          From
        </label>
        <input
          id="dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={rawParams.dateFrom ? String(rawParams.dateFrom).slice(0, 10) : ""}
          className="h-9 border border-border-strong bg-background px-3 text-sm"
        />
      </div>
      <div>
        <label htmlFor="dateTo" className="mb-1 block text-xs font-medium text-muted">
          To
        </label>
        <input
          id="dateTo"
          name="dateTo"
          type="date"
          defaultValue={rawParams.dateTo ? String(rawParams.dateTo).slice(0, 10) : ""}
          className="h-9 border border-border-strong bg-background px-3 text-sm"
        />
      </div>

      {showCustomer && (
        <div>
          <label htmlFor="customer" className="mb-1 block text-xs font-medium text-muted">
            Customer
          </label>
          <input
            id="customer"
            name="customer"
            defaultValue={rawParams.customer ?? ""}
            placeholder="Name or email"
            className="h-9 w-48 border border-border-strong bg-background px-3 text-sm"
          />
        </div>
      )}

      {showOrderStatus && (
        <div>
          <label htmlFor="orderStatus" className="mb-1 block text-xs font-medium text-muted">
            Order status
          </label>
          <select
            id="orderStatus"
            name="orderStatus"
            defaultValue={rawParams.orderStatus ?? ""}
            className="h-9 w-40 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="">Any status</option>
            {Object.values(OrderStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {showStockStatus && (
        <div>
          <label htmlFor="stockStatus" className="mb-1 block text-xs font-medium text-muted">
            Stock status
          </label>
          <select
            id="stockStatus"
            name="stockStatus"
            defaultValue={rawParams.stockStatus ?? "all"}
            className="h-9 w-40 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </div>
      )}

      {showRefundStatus && (
        <div>
          <label htmlFor="refundStatus" className="mb-1 block text-xs font-medium text-muted">
            Refund status
          </label>
          <select
            id="refundStatus"
            name="refundStatus"
            defaultValue={rawParams.refundStatus ?? ""}
            className="h-9 w-40 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="">Any status</option>
            {Object.values(RefundRequestStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {showQuoteStatus && (
        <div>
          <label htmlFor="quoteStatus" className="mb-1 block text-xs font-medium text-muted">
            Quote status
          </label>
          <select
            id="quoteStatus"
            name="quoteStatus"
            defaultValue={rawParams.quoteStatus ?? ""}
            className="h-9 w-40 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="">Any status</option>
            {Object.values(QuoteStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" size="sm">
        Apply
      </Button>
      <Button asChild type="button" variant="ghost" size="sm">
        <Link href={`/admin/reports?type=${type}`}>Clear</Link>
      </Button>
    </form>
  );
}
