import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { accountService } from "@/server/services/account-service";
import { profileUpdateSchema } from "@/lib/validations/account";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/account — the current session user's own profile. This is an ownership
 * check, not a permission check (docs/IMPLEMENTATION_PLAN.md Phase 6): `requireSession`
 * gives us the caller's own id, and that id is the only one ever queried — there is no
 * way to pass a different user's id in.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const profile = await accountService.getProfile(session.userId);
    return NextResponse.json({ item: profile });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/account — updates the caller's own name/phone/email. An email change
 * requires `currentPassword` (enforced in accountService.updateProfile).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const input = profileUpdateSchema.parse(body);
    const profile = await accountService.updateProfile(session.userId, input);

    return NextResponse.json({ item: profile });
  } catch (error) {
    return toErrorResponse(error);
  }
}
