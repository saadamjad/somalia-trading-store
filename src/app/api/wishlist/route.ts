import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { wishlistService } from "@/server/services/wishlist-service";
import { wishlistItemInputSchema } from "@/lib/validations/wishlist";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/wishlist — the caller's own server wishlist only, scoped by session userId. */
export async function GET() {
  try {
    const session = await requireSession();
    const items = await wishlistService.getWishlistForUser(session.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/wishlist — adds a product to the caller's wishlist. Duplicate-prevention is
 * enforced server-side via a DB unique constraint (see wishlist-service.ts), not just
 * client-side dedup — sending the same POST twice is safe and idempotent.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = wishlistItemInputSchema.parse(body);
    const items = await wishlistService.addItem(session.userId, input.productId);

    return NextResponse.json({ items }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
