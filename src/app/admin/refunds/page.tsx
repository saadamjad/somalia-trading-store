import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { refundRequestService } from "@/server/services/refund-request-service";
import { refundRequestAdminQuerySchema } from "@/lib/validations/refund-request";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "Refund Requests | Admin" };

const REFUND_STATUSES = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  REQUESTED: "outline",
  UNDER_REVIEW: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
};

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Admin refund-request list — mirrors /admin/orders' structure (plain GET-form
 * filters, no client JS required to use the list). Gated on `refunds.view`; the real
 * security boundary is `/api/admin/refund-requests` re-checking the same permission
 * server-side.
 */
export default async function AdminRefundsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/refunds");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("refunds.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view refund requests.</p>
      </div>
    );
  }

  const rawParams = await searchParams;
  const parsed = refundRequestAdminQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : refundRequestAdminQuerySchema.parse({});

  const result = await refundRequestService.adminList(query);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildPageHref(page: number) {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    params.set("page", String(page));
    params.set("pageSize", String(query.pageSize));
    return `/admin/refunds?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">Refund Requests</h1>
        <p className="text-sm text-muted">{result.total} total</p>
      </div>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 border border-border bg-surface p-4"
      >
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status ?? ""}
            className="h-9 w-48 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="">Any status</option>
            {REFUND_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {query.status && (
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href="/admin/refunds">Clear</Link>
          </Button>
        )}
      </form>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Order Total</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/refunds/${r.id}`} className="text-accent underline">
                    {r.order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.requestedBy.name}</td>
                <td className="px-4 py-3 text-muted">{r.reasonCategory.replaceAll("_", " ")}</td>
                <td className="px-4 py-3 text-muted">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatPrice(r.order.total, r.order.currency)}
                </td>
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No refund requests match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {query.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={query.page <= 1}>
              <Link
                href={buildPageHref(Math.max(1, query.page - 1))}
                aria-disabled={query.page <= 1}
              >
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={query.page >= totalPages}>
              <Link
                href={buildPageHref(Math.min(totalPages, query.page + 1))}
                aria-disabled={query.page >= totalPages}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
