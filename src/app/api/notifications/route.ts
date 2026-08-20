import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { notificationService } from "@/server/services/notification-service";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/notifications — the caller's own notifications only, newest first.
 * Ownership-scoped via `requireSession()`; there is no id-based "any notification"
 * endpoint since every access here is inherently "my own", same convention as
 * /api/refund-requests and /api/quotes.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const items = await notificationService.listForUser(session.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}
