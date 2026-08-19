import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { refundRequestService } from "@/server/services/refund-request-service";
import { refundRequestAdminQuerySchema } from "@/lib/validations/refund-request";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/admin/refund-requests — admin only (`refunds.view`). Across ALL customers'
 * refund requests, optionally filtered by status — unlike `/api/refund-requests`,
 * which is intentionally scoped to "my requests only". A separate endpoint family,
 * same pattern as /api/admin/orders vs /api/orders.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("refunds.view");

    const { searchParams } = new URL(request.url);
    const query = refundRequestAdminQuerySchema.parse(Object.fromEntries(searchParams));

    const result = await refundRequestService.adminList(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
