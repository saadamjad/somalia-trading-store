import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { accountService } from "@/server/services/account-service";
import { changePasswordSchema } from "@/lib/validations/account";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * PATCH /api/account/password — changes the caller's own password. Requires the
 * correct current password; a wrong one is rejected (400) without updating anything —
 * see accountService.changePassword.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = changePasswordSchema.parse(body);
    await accountService.changePassword(session.userId, input);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
