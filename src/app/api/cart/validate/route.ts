import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth/session";
import { cartService } from "@/server/services/cart-service";
import { cartValidateSchema } from "@/lib/validations/cart";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * POST /api/cart/validate — checks a set of {productId, quantity} pairs against
 * current inventory and returns which ones (if any) exceed available stock. Not
 * `requireSession()`-gated: unlike /api/cart, this doesn't read or write anyone's
 * personal cart — it's a stateless stock check the caller can run against ANY list of
 * items, including a guest's localStorage cart, so a guest gets the same "this item
 * now exceeds stock" feedback on the cart page a logged-in user does. This mirrors the
 * "public-safe stock lookup" pattern the Phase 7 spec calls for: checking whether N
 * units are available is not an admin action, unlike GET /api/inventory (which is
 * `inventory.view`-gated because it exposes admin-shaped data across every product).
 *
 * - Body `{ items: [...] }` validates exactly those items (guest or ad-hoc use).
 * - Body `{}` (no items) with an active session validates that user's own server cart.
 * - Body `{}` with no session and no items is a 400 — nothing to validate.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = cartValidateSchema.parse(body);

    let items = input.items;
    if (!items) {
      const session = await getCurrentSession();
      if (!session) {
        return NextResponse.json(
          { error: "Provide `items` to validate, or sign in to validate your own cart." },
          { status: 400 }
        );
      }
      items = await cartService.getCartForUser(session.userId);
    }

    const issues = await cartService.validateStock(items);
    return NextResponse.json({ issues });
  } catch (error) {
    return toErrorResponse(error);
  }
}
