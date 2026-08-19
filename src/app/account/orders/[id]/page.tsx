import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { RequestRefundForm } from "@/components/refunds/request-refund-form";
import { getCurrentSession } from "@/server/auth/session";
import { orderService, OrderNotFoundError } from "@/server/services/order-service";
import {
  refundRequestService,
  ELIGIBLE_ORDER_STATUSES,
} from "@/server/services/refund-request-service";
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

  // Folded into the order-detail view rather than a separate /account/refunds list
  // (Phase 10 plan leaves this open) — a customer only ever needs "does THIS order
  // have a refund request and what's its status", which this page already answers for
  // order status; a dedicated list page would be a second UI for the same handful of
  // rows most customers will ever have.
  const allRefundRequests = await refundRequestService.listForUser(session.userId);
  const refundRequestsForOrder = allRefundRequests.filter((r) => r.order.id === order.id);
  const hasOpenRefundRequest = refundRequestsForOrder.some(
    (r) => r.status === "REQUESTED" || r.status === "UNDER_REVIEW"
  );
  const canRequestRefund =
    ELIGIBLE_ORDER_STATUSES.includes(order.status as (typeof ELIGIBLE_ORDER_STATUSES)[number]) &&
    !hasOpenRefundRequest;

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

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Order Status</h2>
          <StatusTimeline entries={order.statusHistory} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Refund Requests</h2>

          {refundRequestsForOrder.length === 0 && (
            <p className="text-sm text-muted">No refund request has been made for this order.</p>
          )}

          {refundRequestsForOrder.map((r) => (
            <div key={r.id} className="space-y-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{r.status}</Badge>
                <span className="text-sm text-muted">
                  {r.reasonCategory.replaceAll("_", " ")} &middot;{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              {r.reasonDetail && <p className="text-sm text-muted">&ldquo;{r.reasonDetail}&rdquo;</p>}
              {r.adminNote && (
                <p className="text-sm">
                  <span className="font-medium">Note from our team: </span>
                  {r.adminNote}
                </p>
              )}
            </div>
          ))}

          {canRequestRefund && (
            <div className="border-t border-border pt-4">
              <RequestRefundForm orderId={order.id} />
            </div>
          )}

          {!canRequestRefund && refundRequestsForOrder.length === 0 && (
            <p className="text-xs text-muted">
              Refund requests can be made once an order has been confirmed. Still-pending
              orders can be cancelled instead.
            </p>
          )}
        </CardContent>
      </Card>

      <Link href="/account/orders" className="text-sm font-medium text-accent underline">
        Back to Orders
      </Link>
    </div>
  );
}
