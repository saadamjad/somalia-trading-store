import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentSession } from "@/server/auth/session";
import { orderService, OrderNotFoundError } from "@/server/services/order-service";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "My Account | Order Detail" };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}

/**
 * Doubles as the checkout confirmation view (docs/IMPLEMENTATION_PLAN.md Phase 8 —
 * "don't build two separate 'show me my order' UIs when one will do"): the
 * `?placed=1` query param, set only by checkout-form.tsx right after a successful
 * order-creation POST, shows a one-time confirmation banner. The page itself works
 * identically without it — this is the same ownership-checked detail view used from
 * /account/orders.
 */
export default async function AccountOrderDetailPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/account/orders");
  }

  const { id } = await params;
  const { placed } = await searchParams;

  let order;
  try {
    order = await orderService.getOwned(id, session.userId);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-8">
      {placed === "1" && (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <p className="font-semibold text-success">Order placed</p>
            <p className="text-sm text-muted">
              Thank you — your order has been received. No online payment is collected
              at this time; you&apos;ll be contacted about payment and delivery
              separately.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-muted">
            Placed {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{order.status}</Badge>
          <Badge variant="outline">{order.paymentStatus}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Items</h2>
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  {item.sku && <p className="text-muted">SKU: {item.sku}</p>}
                  <p className="text-muted">
                    {formatPrice(item.unitPrice, order.currency)} × {item.quantity}
                  </p>
                </div>
                <span className="font-semibold">
                  {formatPrice(item.lineTotal, order.currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-border pt-4 text-lg font-bold">
            <span>Total</span>
            <span>{formatPrice(order.total, order.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-6 text-sm">
          <h2 className="font-display text-lg font-semibold">Shipping To</h2>
          <p className="font-medium">{order.shipping.recipientName}</p>
          <p className="text-muted">{order.shipping.phone}</p>
          <p className="text-muted">
            {order.shipping.line1}
            {order.shipping.line2 ? `, ${order.shipping.line2}` : ""}
          </p>
          <p className="text-muted">
            {[order.shipping.city, order.shipping.region, order.shipping.postalCode]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="text-muted">{order.shipping.country}</p>
        </CardContent>
      </Card>

      {order.customerNote && (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm">
            <h2 className="font-display text-lg font-semibold">Order Note</h2>
            <p className="text-muted">{order.customerNote}</p>
          </CardContent>
        </Card>
      )}

      <Link href="/account/orders" className="text-sm font-medium text-accent underline">
        Back to Orders
      </Link>
    </div>
  );
}
