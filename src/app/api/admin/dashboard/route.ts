import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { dashboardService } from "@/server/services/dashboard-service";
import { dashboardQuerySchema } from "@/lib/validations/dashboard";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/admin/dashboard — aggregated operational summary for `/admin`. Gated on
 * `products.view`, the same stand-in permission `/admin/layout.tsx` uses for "can
 * enter the admin area at all" (see that file's comment) — the dashboard surfaces a
 * cross-resource summary (orders/customers/products/inventory/refunds/quotes), not a
 * single resource's data, so it doesn't cleanly map to one narrower permission key.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("products.view");

    const { searchParams } = new URL(request.url);
    const query = dashboardQuerySchema.parse(Object.fromEntries(searchParams));

    const summary = await dashboardService.getSummary(query.period);
    return NextResponse.json(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}
