import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession, requireSession } from "@/server/auth/session";
import { quoteService } from "@/server/services/quote-service";
import { quoteCreateSchema } from "@/lib/validations/quote";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/quotes — the caller's own submitted quotes only (requires a session; guest
 * quotes have no way to be looked up here — see Quote's schema comment). */
export async function GET() {
  try {
    const session = await requireSession();
    const items = await quoteService.listForUser(session.userId);
    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * POST /api/quotes — creates a NEW quote. Deliberately does NOT require a session
 * (docs/IMPLEMENTATION_PLAN.md Phase 11: a quote is a business inquiry, guest
 * submission is a legitimate difference from checkout's auth-required decision). If
 * the caller happens to be logged in, their userId is attached automatically (never
 * trusted from the request body — always read from the server-verified session, same
 * as every other authenticated write in this codebase).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();

    const body = await request.json();
    const input = quoteCreateSchema.parse(body);
    const quote = await quoteService.submit(session?.userId ?? null, input);

    return NextResponse.json({ item: quote }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
