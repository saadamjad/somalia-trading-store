import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { couponService } from "@/server/services/coupon-service";
import { couponCreateSchema } from "@/lib/validations/coupon";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/admin/coupons — admin only (`coupons.view`). No pagination — coupon
 * counts are expected to stay small (dozens, not thousands), same proportionality
 * call as the existing product/category list endpoints at this scale. */
export async function GET() {
  try {
    await requirePermission("coupons.view");
    const items = await couponService.adminList();
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/coupons — admin only (`coupons.manage`). */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("coupons.manage");

    const body = await request.json();
    const input = couponCreateSchema.parse(body);

    const coupon = await couponService.adminCreate(input);
    return NextResponse.json({ item: coupon }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
