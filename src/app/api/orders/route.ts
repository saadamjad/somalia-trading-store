import { NextRequest, NextResponse } from "next/server";
import { requireSession, getCurrentSession } from "@/server/auth/session";
import { orderService } from "@/server/services/order-service";
import {
  orderCreateSchema,
  orderCustomerQuerySchema,
  guestOrderCreateSchema,
} from "@/lib/validations/order";
import { toErrorResponse } from "@/server/lib/api-errors";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/server/lib/rate-limit";

/**
 * GET /api/orders — the caller's own orders only, scoped by session userId. Accepts an
 * optional `?status=` filter (Phase 9) — still always scoped to `session.userId`, never
 * any other customer's orders.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const { status } = orderCustomerQuerySchema.parse(Object.fromEntries(searchParams));
    const items = await orderService.listForUser(session.userId, status);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/orders — creates a real order. No price, quantity, or product data is
 * ever trusted from the client — see src/lib/validations/order.ts. `status`/
 * `paymentStatus` are always PENDING/NOT_PAID on creation (docs/DECISIONS.md D-007)
 * — there is no request field that can change that.
 *
 * Two paths, chosen by whether a session exists (not by a client-supplied flag):
 *  - Logged in: reads the caller's server-side cart (unchanged from before).
 *  - No session: guest checkout — `items` comes from the request body (the guest's
 *    local cart, cart-store.ts), and order-service.ts `createGuestOrder` finds/creates
 *    a password-less User row so Order.userId still has a real account to point to.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`checkout:${ip}`, RATE_LIMITS.checkout.limit, RATE_LIMITS.checkout.windowMs);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many order attempts. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      );
    }

    const session = await getCurrentSession();
    const body = await request.json();

    if (!session) {
      const input = guestOrderCreateSchema.parse(body);
      const order = await orderService.createGuestOrder(input);
      return NextResponse.json({ item: order }, { status: 201 });
    }

    const input = orderCreateSchema.parse(body);
    const order = await orderService.createOrder(session.userId, input);

    return NextResponse.json({ item: order }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
