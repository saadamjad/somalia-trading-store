import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusTimeline } from "@/components/orders/status-timeline";
import { RefundRequestReviewForm } from "@/components/admin/refund-request-review-form";
import { getCurrentSession } from "@/server/auth/session";
import { getRolePermissions } from "@/server/auth/permissions";
import {
  refundRequestService,
  RefundRequestNotFoundError,
} from "@/server/services/refund-request-service";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "Refund Request Detail | Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminRefundDetailPage({ params }: PageProps) {
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

  const canManage = permissions.has("refunds.manage");

  const { id } = await params;
  let refundRequest;
  try {
    refundRequest = await refundRequestService.adminGetById(id);
  } catch (error) {
    if (error instanceof RefundRequestNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/refunds" className="text-sm font-medium text-accent underline">
          Back to Refund Requests
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Refund Request &mdash;{" "}
            <Link href={`/admin/orders/${refundRequest.order.id}`} className="text-accent underline">
              {refundRequest.order.orderNumber}
            </Link>
          </h1>
          <p className="text-sm text-muted">
            Requested {new Date(refundRequest.createdAt).toLocaleString()} by{" "}
            {refundRequest.requestedBy.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{refundRequest.status}</Badge>
          <Badge variant="outline">Order: {refundRequest.order.status}</Badge>
          <Badge variant="outline">Payment: {refundRequest.order.paymentStatus}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 p-6 text-sm">
          <h2 className="font-display text-lg font-semibold">Request</h2>
          <p>
            <span className="font-medium">Reason: </span>
            {refundRequest.reasonCategory.replaceAll("_", " ")}
          </p>
          {refundRequest.reasonDetail && (
            <p className="text-muted">&ldquo;{refundRequest.reasonDetail}&rdquo;</p>
          )}
          <p className="text-muted">
            Order total: {formatPrice(refundRequest.order.total, refundRequest.order.currency)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">Review</h2>
          <p className="text-xs text-muted">
            Approving here is a business decision that we agree the customer should be
            refunded — it does NOT move any money and does not change the order&apos;s
            payment status, since no payment gateway exists yet.
          </p>
          {canManage ? (
            <RefundRequestReviewForm
              refundRequestId={refundRequest.id}
              currentStatus={refundRequest.status}
              initialAdminNote={refundRequest.adminNote}
            />
          ) : (
            <p className="text-sm text-muted">
              Your account does not have permission to act on refund requests.
            </p>
          )}
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
            <StatusTimeline entries={refundRequest.statusHistory} showAdminDetail />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
