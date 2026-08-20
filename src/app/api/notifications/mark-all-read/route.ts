import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { notificationService } from "@/server/services/notification-service";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * POST /api/notifications/mark-all-read — marks every unread notification belonging
 * to the caller read in one call. Scoped entirely by `session.userId`
 * (notification-service.ts `markAllRead`) — there is no way to pass any other user's
 * id here, so there's nothing to IDOR.
 */
export async function POST() {
  try {
    const session = await requireSession();
    const result = await notificationService.markAllRead(session.userId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
