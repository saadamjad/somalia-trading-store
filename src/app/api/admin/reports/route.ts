import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { reportService } from "@/server/services/report-service";
import { reportQuerySchema } from "@/lib/validations/reports";
import { toErrorResponse } from "@/server/lib/api-errors";

/**
 * GET /api/admin/reports — Phase 14. Gated on `reports.view`. Returns the same
 * `ReportTable` JSON shape `/admin/reports/[type]` renders server-side (this route
 * exists for programmatic/JSON access; the admin pages call `reportService` directly).
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("reports.view");

    const { searchParams } = new URL(request.url);
    const query = reportQuerySchema.parse(Object.fromEntries(searchParams));

    const table = await reportService.build(query);
    return NextResponse.json(table);
  } catch (error) {
    return toErrorResponse(error);
  }
}
