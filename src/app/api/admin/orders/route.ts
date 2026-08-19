import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { orderService } from "@/server/services/order-service";
import { orderAdminQuerySchema } from "@/lib/validations/order";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/admin/orders — admin only (`orders.view`). Search/filter/sort/paginate
 * across ALL customers' orders — unlike `/api/orders`, which is intentionally scoped
 * to "my orders only" and must stay that way (see order-service.ts `listForUser`/
 * `getOwned`). This is a separate, broader-access endpoint rather than a mode switch
 * on the customer route, so the ownership boundary on `/api/orders` can never be
 * accidentally weakened by admin-list changes.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("orders.view");

    const { searchParams } = new URL(request.url);
    const query = orderAdminQuerySchema.parse(Object.fromEntries(searchParams));

    const result = await orderService.adminList(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
