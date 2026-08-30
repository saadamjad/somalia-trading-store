import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { cartService } from "@/server/services/cart-service";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ productId: string }>;
}

/**
 * DELETE /api/cart/[productId]?variantId=... — removes one item (a specific variant
 * line if `variantId` is given, otherwise the plain non-variant line) from the
 * caller's own server cart. There's no cart id in the URL to guess/enumerate: the
 * target cart is always "the session user's cart", so this has no IDOR surface by
 * construction (see the ownership test in cart-service.test.ts).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { productId } = await params;
    const variantId = request.nextUrl.searchParams.get("variantId");
    const items = await cartService.removeItem(session.userId, productId, variantId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}
