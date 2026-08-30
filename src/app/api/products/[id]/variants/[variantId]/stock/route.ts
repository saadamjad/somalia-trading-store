import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { productVariantService } from "@/server/services/product-variant-service";
import { variantStockAdjustSchema } from "@/lib/validations/product-variant";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string; variantId: string }>;
}

/**
 * POST /api/products/[id]/variants/[variantId]/stock — admin only
 * (`inventory.update`). Same signed-delta, atomic-conditional-UPDATE contract as
 * PATCH /api/inventory — see productVariantService.adjustStock.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("inventory.update");
    const { variantId } = await params;

    const body = await request.json();
    const input = variantStockAdjustSchema.parse(body);

    const result = await productVariantService.adjustStock({
      variantId,
      delta: input.delta,
      reason: input.reason,
      note: input.note,
      actorId: session.userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
