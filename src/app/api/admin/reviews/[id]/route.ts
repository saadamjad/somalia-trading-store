import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { reviewService } from "@/server/services/review-service";
import { reviewAdminUpdateSchema } from "@/lib/validations/review";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/reviews/[id] — admin only (`reviews.manage`). Approves or rejects
 * a review; re-moderation (e.g. un-approving a previously approved review) is allowed
 * since this is a single overwritable status field, not a terminal-state machine —
 * see review-service.ts `updateStatus`.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("reviews.manage");
    const { id } = await params;

    const body = await request.json();
    const input = reviewAdminUpdateSchema.parse(body);

    const review = await reviewService.updateStatus(id, input.status);
    return NextResponse.json({ item: review });
  } catch (error) {
    return toErrorResponse(error);
  }
}
