import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { adminUserService } from "@/server/services/admin-user-service";
import { adminUserResetPasswordSchema } from "@/lib/validations/admin-user";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/users/[id]/reset-password — issue a new temp password for a staff
 * account, forcing a change on their next login. Gated on `admin_users.reset_password`
 * — split from `admin_users.update` since resetting another admin's credentials is a
 * materially higher-risk action than editing their name.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("admin_users.reset_password");
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { password } = adminUserResetPasswordSchema.parse(body);

    const { tempPassword } = await adminUserService.resetPassword(id, session, password);

    return NextResponse.json({ tempPassword });
  } catch (error) {
    return toErrorResponse(error);
  }
}
