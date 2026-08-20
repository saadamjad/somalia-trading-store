import ExcelJS from "exceljs";
import type { ReportTable } from "@/server/services/report-service";

/**
 * Renders a `ReportTable` as an XLSX workbook buffer. Same field set as the on-screen
 * report and the CSV export — no extra internal columns.
 */
export async function toXlsx(table: ReportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Somalia Trading Store — Admin Reports";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(table.title.slice(0, 31) || "Report");

  sheet.addRow([table.title]);
  sheet.addRow([`Generated: ${table.generatedAt}`]);
  for (const filter of table.appliedFilters) {
    sheet.addRow([`${filter.label}: ${filter.value}`]);
  }
  sheet.addRow([]);

  const headerRow = sheet.addRow(table.columns.map((c) => c.label));
  headerRow.font = { bold: true };

  for (const row of table.rows) {
    sheet.addRow(table.columns.map((c) => row[c.key] ?? ""));
  }

  sheet.columns.forEach((col, index) => {
    const column = table.columns[index];
    col.width = Math.max(12, (column?.label.length ?? 10) + 4);
    if (column?.align === "right") {
      col.alignment = { horizontal: "right" };
    }
  });

  if (table.summary.length > 0) {
    sheet.addRow([]);
    const summaryHeader = sheet.addRow(["Summary"]);
    summaryHeader.font = { bold: true };
    for (const item of table.summary) {
      sheet.addRow([item.label, item.value]);
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
