import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { dashboardService } from "@/server/services/dashboard-service";
import { dashboardQuerySchema } from "@/lib/validations/dashboard";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/admin/dashboard — aggregated operational summary for `/admin`. Gated on
 * `dashboard.view`, a dedicated permission (Admin User Management & RBAC pass) so
 * that seeing the product catalog does not implicitly grant visibility into
 * store-wide order-value/financial figures — see src/app/admin/page.tsx's comment.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("dashboard.view");

    const { searchParams } = new URL(request.url);
    const query = dashboardQuerySchema.parse(Object.fromEntries(searchParams));

    const summary = await dashboardService.getSummary(query.period);
    return NextResponse.json(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}
