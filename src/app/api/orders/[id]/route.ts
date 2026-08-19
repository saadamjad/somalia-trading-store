import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { orderService } from "@/server/services/order-service";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/orders/[id] — re-verifies ownership against the session user on THIS
 * specific id (orderService.getOwned queries `WHERE id = ... AND userId = ...`), not
 * just filtered from the list endpoint. Guessing/enumerating another customer's order
 * id gets the same 404 as a nonexistent id — same IDOR pattern as
 * src/app/api/addresses/[id]/route.ts (Phase 6).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const order = await orderService.getOwned(id, session.userId);
    return NextResponse.json({ item: order });
  } catch (error) {
    return toErrorResponse(error);
  }
}
