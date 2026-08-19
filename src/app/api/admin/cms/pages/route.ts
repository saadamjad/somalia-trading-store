import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { cmsPageService } from "@/server/services/cms-page-service";
import { cmsPageCreateSchema } from "@/lib/validations/cms";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/admin/cms/pages — admin list, all pages regardless of published state. Gated on `cms.view`. */
export async function GET() {
  try {
    await requirePermission("cms.view");
    const items = await cmsPageService.adminList();
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** POST /api/admin/cms/pages — admin only (`cms.manage`). */
export async function POST(request: NextRequest) {
  try {
    await requirePermission("cms.manage");
    const body = await request.json();
    const input = cmsPageCreateSchema.parse(body);
    const page = await cmsPageService.create(input);
    return NextResponse.json({ item: page }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
