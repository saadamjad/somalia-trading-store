import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { productVariantService } from "@/server/services/product-variant-service";
import { variantCreateSchema } from "@/lib/validations/product-variant";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/products/[id]/variants — admin only (`products.view`). All variants
 * (including inactive), for the admin product edit page's variant manager. The
 * storefront reads active variants server-side directly via
 * productVariantService.listActiveForProduct in the product page, not this route. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("products.view");
    const { id } = await params;
    const items = await productVariantService.listForProduct(id);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/products/[id]/variants — admin only (`products.create`). Creates a
 * variant with its initial stock in one atomic operation. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("products.create");
    const { id } = await params;

    const body = await request.json();
    const input = variantCreateSchema.parse(body);

    const variant = await productVariantService.create({
      productId: id,
      sku: input.sku,
      attributes: input.attributes,
      price: input.price ?? null,
      image: input.image || null,
      initialStock: input.initialStock,
      lowStockThreshold: input.lowStockThreshold,
    });

    return NextResponse.json({ item: variant }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
