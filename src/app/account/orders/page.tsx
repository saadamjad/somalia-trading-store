import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentSession } from "@/server/auth/session";
import { orderService } from "@/server/services/order-service";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "My Account | Orders" };

/**
 * Minimal order history — list only, enough for a customer to see their own placed
 * order(s) exist and open one. Search/filter/sort and richer status UI is Phase 9
 * (docs/IMPLEMENTATION_PLAN.md) — intentionally not built here.
 */
export default async function AccountOrdersPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account/orders");
  }

  const orders = await orderService.listForUser(session.userId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted">Your placed orders.</p>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted">
          You haven&apos;t placed any orders yet.{" "}
          <Link href="/shop" className="font-medium text-accent underline">
            Start shopping
          </Link>
          .
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
