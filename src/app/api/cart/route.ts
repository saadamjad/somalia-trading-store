import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { cartService } from "@/server/services/cart-service";
import { cartItemInputSchema, cartMergeSchema } from "@/lib/validations/cart";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/cart — the caller's own server cart only, scoped by session userId. */
export async function GET() {
  try {
    const session = await requireSession();
    const items = await cartService.getCartForUser(session.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/cart — upserts a single item to an absolute quantity. This is the
 * background write-through target for the client cart store's addItem/updateQuantity
 * mutations (src/stores/cart-store.ts) once a session exists.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = cartItemInputSchema.parse(body);
    const items = await cartService.setItem(session.userId, input.productId, input.quantity);

    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PUT /api/cart — merges a batch of items (typically a guest's localStorage cart) into
 * the caller's server cart, summing quantities on conflict. Used both at login time and
 * to reconcile an already-authenticated page load with whatever's still in
 * localStorage — see cart-service.mergeGuestItems for the conflict-resolution rule.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = cartMergeSchema.parse(body);
    const items = await cartService.mergeGuestItems(session.userId, input.items);

    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/cart — clears the caller's entire server cart. */
export async function DELETE() {
  try {
    const session = await requireSession();
    await cartService.clearCart(session.userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
