import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { cmsPageService } from "@/server/services/cms-page-service";
import { cmsPageUpdateSchema } from "@/lib/validations/cms";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/cms/pages/[id] — admin only (`cms.view`). Regardless of published state. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("cms.view");
    const { id } = await params;
    const page = await cmsPageService.adminGetById(id);
    return NextResponse.json({ item: page });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/admin/cms/pages/[id] — admin only (`cms.manage`). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("cms.manage");
    const { id } = await params;
    const body = await request.json();
    const input = cmsPageUpdateSchema.parse(body);
    const page = await cmsPageService.update(id, input);
    return NextResponse.json({ item: page });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/cms/pages/[id] — admin only (`cms.manage`). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("cms.manage");
    const { id } = await params;
    await cmsPageService.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
