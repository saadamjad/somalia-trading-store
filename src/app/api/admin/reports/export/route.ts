import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/auth/permissions";
import { reportService } from "@/server/services/report-service";
import { reportExportQuerySchema } from "@/lib/validations/reports";
import { toCsv } from "@/server/lib/export/csv";
import { toXlsx } from "@/server/lib/export/xlsx";
import { toPdf } from "@/server/lib/export/pdf";
import { toErrorResponse } from "@/server/lib/api-errors";

const CONTENT_TYPES: Record<string, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/**
 * GET /api/admin/reports/export — server-generated file export, gated on the SAME
 * `reports.view` permission as the on-screen report (not a separate, looser
 * permission) so an export can never expose data the requester couldn't already see on
 * screen. Generated from the exact same `reportService.build` call the page uses, so
 * the exported file always matches what's currently on screen for the same filters —
 * never a client-side re-derivation that could drift from the server data.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("reports.view");

    const { searchParams } = new URL(request.url);
    const query = reportExportQuerySchema.parse(Object.fromEntries(searchParams));

    const table = await reportService.build(query);
    const filenameBase = `${query.type}-report-${new Date().toISOString().slice(0, 10)}`;

    if (query.format === "csv") {
      const csv = toCsv(table);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": CONTENT_TYPES.csv,
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        },
      });
    }

    if (query.format === "xlsx") {
      const buffer = await toXlsx(table);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": CONTENT_TYPES.xlsx,
          "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
        },
      });
    }

    const buffer = await toPdf(table);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES.pdf,
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
