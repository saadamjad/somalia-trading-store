import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { adminUserService } from "@/server/services/admin-user-service";
import { adminUserStatusSchema } from "@/lib/validations/admin-user";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/[id]/status — activate/deactivate a staff account. Gated on
 * `admin_users.deactivate`. Self-deactivation and last-super-admin protection are
 * enforced in adminUserService, not here — this route is a thin dispatch.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("admin_users.deactivate");
    const { id } = await params;
    const body = await request.json();
    const { active } = adminUserStatusSchema.parse(body);

    const item = active
      ? await adminUserService.reactivate(id, session)
      : await adminUserService.deactivate(id, session);

    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}
