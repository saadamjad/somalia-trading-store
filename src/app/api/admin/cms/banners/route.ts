import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { bannerService } from "@/server/services/banner-service";
import { bannerCreateSchema } from "@/lib/validations/cms";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/admin/cms/banners — admin list, every banner regardless of active/schedule state. Gated on `cms.view`. */
export async function GET() {
  try {
    await requirePermission("cms.view");
    const items = await bannerService.adminList();
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/cms/banners — admin only (`cms.manage`). */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("cms.manage");
    const body = await request.json();
    const input = bannerCreateSchema.parse(body);
    const banner = await bannerService.create(input);
    return NextResponse.json({ item: banner }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
