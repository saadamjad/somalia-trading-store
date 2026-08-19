import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { quoteService } from "@/server/services/quote-service";
import { quoteConvertSchema } from "@/lib/validations/quote";
import { toErrorResponse } from "@/server/lib/api-errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/quotes/[id]/convert — admin only (`quotes.manage`). Converts an
 * ACCEPTED quote into a real Order, priced at the locked-in `quotedUnitPrice` values
 * (never the product's current live price), after re-validating current stock. See
 * quote-service.ts `convertToOrder` for the full precondition list and rationale
 * (conversion is deliberately admin-triggered, not self-service — a B2B-style manual
 * sales process).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requirePermission("quotes.manage");
    const { id } = await params;

    const body = await request.json();
    const input = quoteConvertSchema.parse(body);

    const result = await quoteService.convertToOrder(id, session.userId, input);
    return NextResponse.json({ item: result.quote, order: result.order }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
