import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { refundRequestService } from "@/server/services/refund-request-service";
import { refundRequestCreateSchema } from "@/lib/validations/refund-request";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/refund-requests — the caller's own refund requests only. */
export async function GET() {
  try {
    const session = await requireSession();
    const items = await refundRequestService.listForUser(session.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/refund-requests — creates a REQUESTED refund request for one of the
 * caller's own orders. Ownership of `orderId` is re-verified server-side
 * (refund-request-service.ts `createForOwner`, 404 not 403 on IDOR) — never trusted
 * from the client. Only eligible order statuses (CONFIRMED/PROCESSING/SHIPPED/
 * DELIVERED) may be requested against; PENDING/CANCELLED orders are rejected with a
 * 400. Never accepts or produces any payment-related field.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = refundRequestCreateSchema.parse(body);
    const refundRequest = await refundRequestService.createForOwner(session.userId, input);

    return NextResponse.json({ item: refundRequest }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
