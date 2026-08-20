import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { notificationService } from "@/server/services/notification-service";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/notifications/unread-count — a lightweight count-only endpoint for the
 * header's unread badge, so the header doesn't need to fetch (and re-render) the full
 * notification list just to show a number.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const count = await notificationService.unreadCountForUser(session.userId);
    return NextResponse.json({ count });
  } catch (error) {
    return toErrorResponse(error);
  }
}
