import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { quoteService } from "@/server/services/quote-service";
import { quoteAdminQuerySchema } from "@/lib/validations/quote";
import { toErrorResponse } from "@/server/lib/api-errors";

/** GET /api/admin/quotes — admin list, filterable by status. Gated on `quotes.view`. */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("quotes.view");
    const { searchParams } = new URL(request.url);
    const query = quoteAdminQuerySchema.parse(Object.fromEntries(searchParams));
    const result = await quoteService.adminList(query);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
