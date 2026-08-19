import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { quoteService } from "@/server/services/quote-service";
import {
  quoteAdminRespondSchema,
  quoteAdminStatusUpdateSchema,
} from "@/lib/validations/quote";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/admin/quotes/[id] — admin only (`quotes.view`). No ownership scoping. */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requirePermission("quotes.view");
    const { id } = await params;
    const quote = await quoteService.adminGetById(id);
    return NextResponse.json({ item: quote });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * PATCH /api/admin/quotes/[id] — admin only (`quotes.manage`). Two shapes, dispatched
 * on the body's own contents:
 *  - `{ items: [...], adminNote? }` — a pricing response, moves the quote to QUOTED
 *    (quote-service.ts `respond`). Every item on the quote must receive a price.
 *  - `{ status: "REVIEWING" | "ACCEPTED" | "DECLINED", note? }` — a plain status
 *    transition (quote-service.ts `adminUpdateStatus`). Never QUOTED (use the items
 *    shape above) or CONVERTED (use POST /api/admin/quotes/[id]/convert).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("quotes.manage");
    const { id } = await params;

    const body = await request.json();

    if (body && typeof body === "object" && "items" in body) {
      const input = quoteAdminRespondSchema.parse(body);
      const quote = await quoteService.respond(id, session.userId, input);
      return NextResponse.json({ item: quote });
    }

    const input = quoteAdminStatusUpdateSchema.parse(body);
    const quote = await quoteService.adminUpdateStatus(id, session.userId, input.status, input.note);
    return NextResponse.json({ item: quote });
  } catch (error) {
    return toErrorResponse(error);
  }
}
