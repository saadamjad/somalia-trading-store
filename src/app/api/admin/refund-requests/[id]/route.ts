import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { refundRequestService } from "@/server/services/refund-request-service";
import { refundRequestAdminUpdateSchema } from "@/lib/validations/refund-request";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/refund-requests/[id] — admin only (`refunds.view`). No ownership scoping. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("refunds.view");
    const { id } = await params;
    const refundRequest = await refundRequestService.adminGetById(id);
    return NextResponse.json({ item: refundRequest });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/admin/refund-requests/[id] — admin only (`refunds.manage`). Approves,
 * rejects, or marks a request under review, validated against the allowed-transitions
 * map, with an optional customer-visible `adminNote`. Never accepts a `paymentStatus`
 * field and never calls any code path that touches `Order.paymentStatus` — this
 * endpoint can only ever change `RefundRequest.status`/`adminNote`/`reviewedBy*`
 * (Phase 10 hard requirement).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("refunds.manage");
    const { id } = await params;

    const body = await request.json();
    const input = refundRequestAdminUpdateSchema.parse(body);

    const refundRequest = await refundRequestService.updateStatus(
      id,
      session.userId,
      input.status,
      input.adminNote
    );

    return NextResponse.json({ item: refundRequest });
  } catch (error) {
    return toErrorResponse(error);
  }
}
