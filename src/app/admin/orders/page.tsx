import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { orderService } from "@/server/services/order-service";
import { orderAdminQuerySchema } from "@/lib/validations/order";
import { formatPrice } from "@/lib/utils";
import { getOrderStatusVariant, getPaymentStatusVariant } from "@/lib/status-variants";

export const metadata = { title: "Orders | Admin" };

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const PAYMENT_STATUSES = ["NOT_PAID", "PAID", "REFUNDED", "FAILED"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Admin order list — search/filter/sort/paginate across every customer's orders.
 * Gated on `orders.view` (checked here, same pattern as /admin/inventory); the real
 * security boundary is `/api/admin/orders` re-checking the same permission
 * server-side, not this page's rendering decision.
 *
 * Filters/sort/pagination are plain query-string state on a native GET form — no
 * client JS required to use the list, matching the rest of the admin area's approach
 * (e.g. /admin/products has no client-side filtering either).
 */
export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/orders");
  }

  if (session.mustChangePassword) {
    redirect("/admin/change-password");
  }

  const permissions = await getRolePermissions(session.role);
  if (!permissions.has("orders.view")) {
    return (
      <div className="container-custom flex min-h-[40vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-2 text-2xl font-bold">Access Denied</h1>
        <p className="text-muted">Your account does not have permission to view orders.</p>
      </div>
    );
  }

  const rawParams = await searchParams;
  const parsed = orderAdminQuerySchema.safeParse(rawParams);
  const query = parsed.success
    ? parsed.data
    : orderAdminQuerySchema.parse({});

  const result = await orderService.adminList(query);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildPageHref(page: number) {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    if (query.paymentStatus) params.set("paymentStatus", query.paymentStatus);
    if (query.orderNumber) params.set("orderNumber", query.orderNumber);
    if (query.customer) params.set("customer", query.customer);
    params.set("sortBy", query.sortBy);
    params.set("sortDir", query.sortDir);
    params.set("page", String(page));
    params.set("pageSize", String(query.pageSize));
    return `/admin/orders?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted">{result.total} total</p>
      </div>

      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 border border-border bg-surface p-4"
      >
        <div>
          <label htmlFor="orderNumber" className="mb-1 block text-xs font-medium text-muted">
            Order #
          </label>
          <input
            id="orderNumber"
            name="orderNumber"
            defaultValue={query.orderNumber ?? ""}
            placeholder="ORD-..."
            className="h-9 w-40 border border-border-strong bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor="customer" className="mb-1 block text-xs font-medium text-muted">
            Customer
          </label>
          <input
            id="customer"
            name="customer"
            defaultValue={query.customer ?? ""}
            placeholder="Name or email"
            className="h-9 w-48 border border-border-strong bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status ?? ""}
            className="h-9 w-40 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="">Any status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="paymentStatus" className="mb-1 block text-xs font-medium text-muted">
            Payment
          </label>
          <select
            id="paymentStatus"
            name="paymentStatus"
            defaultValue={query.paymentStatus ?? ""}
            className="h-9 w-40 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="">Any payment status</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dateFrom" className="mb-1 block text-xs font-medium text-muted">
            From
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={
              rawParams.dateFrom ? String(rawParams.dateFrom).slice(0, 10) : ""
            }
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
        <div>
          <label htmlFor="sortBy" className="mb-1 block text-xs font-medium text-muted">
            Sort
          </label>
          <select
            id="sortBy"
            name="sortBy"
            defaultValue={query.sortBy}
            className="h-9 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="createdAt">Date</option>
            <option value="total">Total</option>
            <option value="orderNumber">Order #</option>
          </select>
        </div>
        <div>
          <label htmlFor="sortDir" className="mb-1 block text-xs font-medium text-muted">
            Direction
          </label>
          <select
            id="sortDir"
            name="sortDir"
            defaultValue={query.sortDir}
            className="h-9 border border-border-strong bg-background px-3 text-sm"
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {(query.status || query.paymentStatus || query.orderNumber || query.customer || rawParams.dateFrom || rawParams.dateTo) && (
          <Button asChild type="button" variant="ghost" size="sm">
            <Link href="/admin/orders">Clear</Link>
          </Button>
        )}
      </form>

      <div className="overflow-x-auto border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((order) => (
              <tr key={order.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/admin/orders/${order.id}`} className="text-accent underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>{order.customer.name}</div>
                  <div className="text-xs text-muted">{order.customer.email}</div>
                </td>
                <td className="px-4 py-3 text-muted">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-muted">{order.itemCount}</td>
                <td className="px-4 py-3">
                  <Badge variant={getOrderStatusVariant(order.status)}>{order.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={getPaymentStatusVariant(order.paymentStatus)}>
                    {order.paymentStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatPrice(order.total, order.currency)}
                </td>
              </tr>
            ))}
            {result.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  No orders match these filters.
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
