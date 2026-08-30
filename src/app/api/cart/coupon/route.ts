import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/server/auth/session";
import { couponService } from "@/server/services/coupon-service";
import { couponPreviewSchema } from "@/lib/validations/coupon";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * POST /api/cart/coupon — validates a coupon code against the caller's cart subtotal
 * and returns the discount it would apply, WITHOUT redeeming it (no usage is
 * consumed here — see order-service.ts `persistOrder` for the actual redemption,
 * which happens atomically with order creation). Works for both guests and logged-in
 * customers, since guest checkout exists (guest carts live client-side); a coupon
 * with a `perCustomerLimit` requires a session, same as couponService.validate.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    const body = await request.json();
    const input = couponPreviewSchema.parse(body);

    const preview = await couponService.validate(input.code, input.subtotal, session?.userId ?? null);
    return NextResponse.json({ item: preview });
  } catch (error) {
    return toErrorResponse(error);
  }
}
