import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { quoteService } from "@/server/services/quote-service";
import { quoteAdminQuerySchema } from "@/lib/validations/quote";
import { getQuoteStatusVariant } from "@/lib/status-variants";

export const metadata = { title: "Quote Requests | Admin" };

const QUOTE_STATUSES = ["NEW", "REVIEWING", "QUOTED", "ACCEPTED", "DECLINED", "CONVERTED"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Admin quote-request list — mirrors /admin/refunds' structure (plain GET-form
 * filters, no client JS required to use the list). Gated on `quotes.view`; the real
 * security boundary is `/api/admin/quotes` re-checking the same permission
 * server-side.
 */
export default async function AdminQuotesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/quotes");
  }

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("quotes.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view quote requests.</p>
      </div>
    );
  }

  const rawParams = await searchParams;
  const parsed = quoteAdminQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : quoteAdminQuerySchema.parse({});

  const result = await quoteService.adminList(query);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildPageHref(page: number) {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    params.set("page", String(page));
    params.set("pageSize", String(query.pageSize));
    return `/admin/quotes?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">Quote Requests</h1>
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
            {QUOTE_STATUSES.map((s) => (
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
            <Link href="/admin/quotes">Clear</Link>
          </Button>
        )}
      </form>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Account</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/quotes/${q.id}`} className="text-accent underline">
                    {q.contact.name}
                  </Link>
                  <div className="text-xs text-muted">{q.contact.email}</div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {q.items.length} item{q.items.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {new Date(q.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getQuoteStatusVariant(q.status)}>{q.status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{q.user ? q.user.email : "Guest"}</td>
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No quote requests match these filters.
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
