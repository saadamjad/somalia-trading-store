import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { adminUserService } from "@/server/services/admin-user-service";
import { adminUserCreateSchema, adminUserListQuerySchema } from "@/lib/validations/admin-user";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/admin/users — list staff/admin/super_admin accounts. Gated on `admin_users.view`. */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("admin_users.view");
    const { searchParams } = new URL(request.url);
    const query = adminUserListQuerySchema.parse(Object.fromEntries(searchParams));
    const items = await adminUserService.list(query);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/admin/users — create a new staff/admin/super_admin account. Gated on
 * `admin_users.create` — only super_admin ever holds this permission (see
 * prisma/seed.ts), which structurally contains privilege escalation since nobody who
 * can reach this route can grant admin_users.* to the account they create.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("admin_users.create");
    const body = await request.json();
    const input = adminUserCreateSchema.parse(body);

    const { user, tempPassword } = await adminUserService.create({
      ...input,
      createdById: session.userId,
    });

    return NextResponse.json({ item: user, tempPassword }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
