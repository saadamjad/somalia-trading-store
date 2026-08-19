import { NextRequest, NextResponse } from "next/server";
import { bannerService } from "@/server/services/banner-service";
import { bannerSlotSchema } from "@/lib/validations/cms";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/cms/banners?slot=HOMEPAGE_HERO — public, no auth/permission gate. Only ever
 * returns the single active, in-schedule-window banner for the slot (or `{ item: null }`
 * if none) — never an inactive/out-of-window banner, so a public caller can never see
 * draft banner content.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slot = bannerSlotSchema.parse(searchParams.get("slot"));
    const item = await bannerService.getActiveForSlot(slot);
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}
