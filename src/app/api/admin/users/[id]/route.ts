import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { adminUserService } from "@/server/services/admin-user-service";
import { adminUserUpdateSchema } from "@/lib/validations/admin-user";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/users/[id] — single staff account. Gated on `admin_users.view`. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("admin_users.view");
    const { id } = await params;
    const item = await adminUserService.getById(id);
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/admin/users/[id] — update name/phone/role. Gated on `admin_users.update`.
 * No DELETE on this route — deactivation is a distinct semantic action (see
 * .../status/route.ts), not a destructive delete.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("admin_users.update");
    const { id } = await params;
    const body = await request.json();
    const input = adminUserUpdateSchema.parse(body);
    const item = await adminUserService.update(id, input, session);
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}
