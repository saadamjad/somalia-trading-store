import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { notificationService } from "@/server/services/notification-service";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/[id] — marks the caller's own notification read.
 * Ownership is re-verified server-side against the session user on THIS specific id
 * (notification-service.ts `markRead`) — a customer guessing/enumerating another
 * customer's notification id gets a 404, not the ability to mark it read (IDOR, same
 * pattern as /api/refund-requests/[id]). No request body is read — marking read is
 * the only action this endpoint performs.
 */
export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const item = await notificationService.markRead(id, session.userId);
    return NextResponse.json({ item });
  } catch (error) {
    return toErrorResponse(error);
  }
}
