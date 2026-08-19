import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/server/auth/session";
import { orderService } from "@/server/services/order-service";
import { orderCustomerQuerySchema } from "@/lib/validations/order";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "My Account | Orders" };

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Order history — list of the caller's own orders (never any other customer's — see
 * order-service.ts `listForUser`, scoped to `session.userId`), with an optional status
 * filter (Phase 9) once there's more than a couple orders to look through.
 */
export default async function AccountOrdersPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account/orders");
  }

  const rawParams = await searchParams;
  const parsed = orderCustomerQuerySchema.safeParse(rawParams);
  const status = parsed.success ? parsed.data.status : undefined;

  const orders = await orderService.listForUser(session.userId, status);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted">Your placed orders.</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">
              Filter by status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status ?? ""}
              className="h-9 border border-border-strong bg-background px-3 text-sm"
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" variant="outline">
            Apply
          </Button>
          {status && (
            <Button asChild type="button" size="sm" variant="ghost">
              <Link href="/account/orders">Clear</Link>
            </Button>
          )}
        </form>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">
          {status ? (
            `No orders with status ${status}.`
          ) : (
            <>
              You haven&apos;t placed any orders yet.{" "}
              <Link href="/shop" className="font-medium text-accent underline">
                Start shopping
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/account/orders/${order.id}`}>
              <Card className="transition-colors hover:border-accent">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-sm text-muted">
                      {new Date(order.createdAt).toLocaleDateString()} &middot;{" "}
                      {order.items.length} item{order.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{order.status}</Badge>
                    <Badge variant="outline">{order.paymentStatus}</Badge>
                    <span className="font-semibold">
                      {formatPrice(order.total, order.currency)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
