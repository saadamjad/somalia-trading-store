import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { productVariantService } from "@/server/services/product-variant-service";
import { variantUpdateSchema } from "@/lib/validations/product-variant";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string; variantId: string }>;
}

/** PATCH /api/products/[id]/variants/[variantId] — admin only (`products.update`). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("products.update");
    const { variantId } = await params;

    const body = await request.json();
    const input = variantUpdateSchema.parse(body);

    const variant = await productVariantService.update(variantId, {
      ...input,
      image: input.image === "" ? null : input.image,
    });

    return NextResponse.json({ item: variant });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * DELETE /api/products/[id]/variants/[variantId] — admin only (`products.delete`).
 * Hard-deletes only if the variant has never appeared on an order (historical order
 * snapshots must survive — see productVariantService.delete); otherwise rejects with
 * a clear error telling the admin to deactivate instead.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("products.delete");
    const { variantId } = await params;

    await productVariantService.delete(variantId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
