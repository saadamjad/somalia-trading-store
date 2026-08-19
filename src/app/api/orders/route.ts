import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { orderService } from "@/server/services/order-service";
import { orderCreateSchema } from "@/lib/validations/order";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/orders — the caller's own orders only, scoped by session userId. */
export async function GET() {
  try {
    const session = await requireSession();
    const items = await orderService.listForUser(session.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/orders — creates a real order from the caller's server-side cart. No
 * price, quantity, or product data is ever accepted from the client here — see
 * src/lib/validations/order.ts. `status`/`paymentStatus` are always PENDING/NOT_PAID
 * on creation (docs/DECISIONS.md D-007) — there is no request field that can change
 * that.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = orderCreateSchema.parse(body);
    const order = await orderService.createOrder(session.userId, input);

    return NextResponse.json({ item: order }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
