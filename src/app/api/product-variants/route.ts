import { NextRequest, NextResponse } from "next/server";
import { productVariantService } from "@/server/services/product-variant-service";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/product-variants?ids=... — public, no auth required. Same "batch lookup
 * for client cart hydration" role as GET /api/products?ids=... (see that route's own
 * comment) — the client cart store only ever holds a variant's id, never its price,
 * so this is how the cart page/mini-cart-drawer/checkout summary resolve a variant
 * line's current price, label, and stock.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get("ids");
    const idList = (ids ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const items = await productVariantService.getByIds(idList);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}
