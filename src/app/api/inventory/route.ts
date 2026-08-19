import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { inventoryService } from "@/server/services/inventory-service";
import { stockAdjustSchema } from "@/lib/validations/inventory";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/inventory — admin only (inventory.view). Returns current stock levels for
 * every product, with a derived low-stock/out-of-stock status per row.
 */
export async function GET() {
  try {
    await requirePermission("inventory.view");

    const items = await inventoryService.getAll();
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/inventory — admin only (inventory.update). Adjusts stock by a signed
 * `delta` (never an absolute "new quantity" — see src/lib/validations/inventory.ts for
 * why). The resulting quantity is validated against the current DB state inside the
 * same DB transaction the update runs in, so this is safe under concurrent requests —
 * see src/server/services/inventory-service.ts and its concurrency test.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePermission("inventory.update");

    const body = await request.json();
    const input = stockAdjustSchema.parse(body);

    const result = await inventoryService.adjustStock({
      productId: input.productId,
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
