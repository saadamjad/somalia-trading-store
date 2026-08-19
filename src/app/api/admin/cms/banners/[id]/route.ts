import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { bannerService } from "@/server/services/banner-service";
import { bannerUpdateSchema } from "@/lib/validations/cms";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/cms/banners/[id] — admin only (`cms.view`). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("cms.view");
    const { id } = await params;
    const banner = await bannerService.adminGetById(id);
    return NextResponse.json({ item: banner });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** PATCH /api/admin/cms/banners/[id] — admin only (`cms.manage`). Also used to toggle `active`. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("cms.manage");
    const { id } = await params;
    const body = await request.json();
    const input = bannerUpdateSchema.parse(body);
    const banner = await bannerService.update(id, input);
    return NextResponse.json({ item: banner });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** DELETE /api/admin/cms/banners/[id] — admin only (`cms.manage`). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("cms.manage");
    const { id } = await params;
    await bannerService.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
