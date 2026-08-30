import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { reviewService } from "@/server/services/review-service";
import { reviewAdminQuerySchema } from "@/lib/validations/review";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/admin/reviews — admin only (`reviews.view`). All statuses, paginated. */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("reviews.view");

    const { searchParams } = new URL(request.url);
    const query = reviewAdminQuerySchema.parse(Object.fromEntries(searchParams));

    const result = await reviewService.adminList(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
