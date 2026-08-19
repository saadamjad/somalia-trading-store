import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { OrderStatusUpdateForm } from "@/components/admin/order-status-update-form";
import { OrderInternalNoteForm } from "@/components/admin/order-internal-note-form";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import { orderService, OrderNotFoundError } from "@/server/services/order-service";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "Order Detail | Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackUrl=/admin/orders");
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

  const canUpdate = permissions.has("orders.update");

  const { id } = await params;
  let order;
  try {
    order = await orderService.adminGetById(id);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/orders" className="text-sm font-medium text-accent underline">
          Back to Orders
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Order {order.orderNumber}</h1>
          <p className="text-sm text-muted">
            Placed {new Date(order.createdAt).toLocaleString()} by {order.customer.name} (
            {order.customer.email})
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
                <span className="font-semibold">{formatPrice(item.lineTotal, order.currency)}</span>
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
            <h2 className="font-display text-lg font-semibold">Customer Note</h2>
            <p className="text-muted">{order.customerNote}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Status</h2>
          {canUpdate ? (
            <OrderStatusUpdateForm orderId={order.id} currentStatus={order.status} />
          ) : (
            <p className="text-sm text-muted">
              Your account does not have permission to update order status.
            </p>
          )}
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
            <StatusTimeline entries={order.statusHistory} showAdminDetail />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Internal Note</h2>
          <p className="text-xs text-muted">
            Visible to admins only — never shown to the customer.
          </p>
          {canUpdate ? (
            <OrderInternalNoteForm orderId={order.id} initialNote={order.internalNote} />
          ) : (
            <p className="text-sm text-muted">{order.internalNote || "No note."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
