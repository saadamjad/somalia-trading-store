import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { refundRequestService } from "@/server/services/refund-request-service";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/refund-requests/[id] — re-verifies ownership against the session user on
 * THIS specific id, not just filtered from the list endpoint. Guessing/enumerating
 * another customer's refund request id gets the same 404 as a nonexistent id — same
 * IDOR pattern as /api/orders/[id].
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const refundRequest = await refundRequestService.getOwned(id, session.userId);
    return NextResponse.json({ item: refundRequest });
  } catch (error) {
    return toErrorResponse(error);
  }
}
