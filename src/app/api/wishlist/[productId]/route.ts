import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { wishlistService } from "@/server/services/wishlist-service";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ productId: string }>;
}

/**
 * DELETE /api/wishlist/[productId] — removes one item from the caller's own server
 * wishlist. No wishlist id in the URL: the target is always "the session user's
 * wishlist", so there's no id a client could pass to target someone else's wishlist.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { productId } = await params;
    const items = await wishlistService.removeItem(session.userId, productId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}
