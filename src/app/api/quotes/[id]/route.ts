import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { quoteService } from "@/server/services/quote-service";
import { quoteCustomerDecisionSchema } from "@/lib/validations/quote";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/quotes/[id] — re-verifies ownership against the session user on THIS
 * specific id, not just filtered from the list endpoint. Same IDOR pattern as
 * /api/orders/[id] and /api/refund-requests/[id]: guessing another customer's quote id
 * gets the same 404 as a nonexistent id.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const quote = await quoteService.getOwned(id, session.userId);
    return NextResponse.json({ item: quote });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/quotes/[id] — the customer's own accept/decline of a QUOTED quote.
 * Ownership-checked; only reachable from QUOTED. Accepting does NOT create an order —
 * conversion is a separate, admin-triggered action (see quote-service.ts
 * `convertToOrder`'s comment for why).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const body = await request.json();
    const input = quoteCustomerDecisionSchema.parse(body);

    const quote = await quoteService.customerUpdateStatus(id, session.userId, input.status);
    return NextResponse.json({ item: quote });
  } catch (error) {
    return toErrorResponse(error);
  }
}
