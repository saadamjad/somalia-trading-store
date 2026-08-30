import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { reviewService } from "@/server/services/review-service";
import { reviewAdminQuerySchema } from "@/lib/validations/review";
import { getReviewStatusVariant } from "@/lib/status-variants";
import { ReviewModerationActions } from "@/components/admin/review-moderation-actions";

export const metadata = { title: "Reviews | Admin" };

const REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Admin review moderation list — mirrors /admin/refunds' structure (plain GET-form
 * filter, no client JS needed to browse/filter). Gated on `reviews.view`; the real
 * security boundary is `/api/admin/reviews` re-checking the same permission
 * server-side, and `/api/admin/reviews/[id]` re-checking `reviews.manage` for the
 * approve/reject action.
 */
export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/reviews");
  }

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("reviews.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view reviews.</p>
      </div>
    );
  }
  const canManage = permissions.has("reviews.manage");

  const rawParams = await searchParams;
  const parsed = reviewAdminQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : reviewAdminQuerySchema.parse({});

  const result = await reviewService.adminList(query);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildPageHref(page: number) {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    params.set("page", String(page));
    params.set("pageSize", String(query.pageSize));
    return `/admin/reviews?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">Reviews</h1>
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
            {REVIEW_STATUSES.map((s) => (
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
            <Link href="/admin/reviews">Clear</Link>
          </Button>
        )}
      </form>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {result.items.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-4 py-3 font-medium">{r.productName}</td>
                <td className="px-4 py-3">
                  {r.author}
                  {r.verifiedPurchase && (
                    <span className="ml-1 text-xs text-success">(Verified)</span>
                  )}
                </td>
                <td className="px-4 py-3">{r.rating} / 5</td>
                <td className="max-w-xs px-4 py-3 text-muted">
                  {r.title && <p className="font-medium text-foreground">{r.title}</p>}
                  <p className="line-clamp-2">{r.body}</p>
                </td>
                <td className="px-4 py-3 text-muted">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getReviewStatusVariant(r.status)}>{r.status}</Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3">
                    <ReviewModerationActions reviewId={r.id} status={r.status} />
                  </td>
                )}
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-muted">
                  No reviews match these filters.
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
