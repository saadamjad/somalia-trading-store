import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { couponService } from "@/server/services/coupon-service";
import { couponUpdateSchema } from "@/lib/validations/coupon";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/coupons/[id] — admin only (`coupons.manage`). Used for both
 * editing terms and deactivating a coupon (`active: false`) — there is no DELETE:
 * a coupon with redemptions can't be hard-deleted (CouponRedemption.couponId is
 * onDelete: Restrict, preserving the historical discount record on past orders),
 * so deactivation is the only "remove" action, matching the product
 * archive/soft-delete pattern elsewhere in this codebase.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("coupons.manage");
    const { id } = await params;

    const body = await request.json();
    const input = couponUpdateSchema.parse(body);

    const coupon = await couponService.adminUpdate(id, input);
    return NextResponse.json({ item: coupon });
  } catch (error) {
    return toErrorResponse(error);
  }
}
