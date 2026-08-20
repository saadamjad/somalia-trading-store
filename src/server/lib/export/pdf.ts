import PDFDocument from "pdfkit";
import type { ReportTable } from "@/server/services/report-service";

/**
 * Renders a `ReportTable` as a simple tabular PDF (title, filters, header row, data
 * rows, summary) — no charts/branding, just a legible export of the same on-screen
 * data. pdfkit was chosen over a headless-browser approach (e.g. puppeteer) since this
 * is plain tabular content, not a styled HTML page — no reason to pull in a full
 * browser runtime for it.
 */
export function toPdf(table: ReportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(table.title, { continued: false });
    doc.fontSize(9).fillColor("#555").text(`Generated: ${table.generatedAt}`);
    if (table.appliedFilters.length > 0) {
      doc.text(table.appliedFilters.map((f) => `${f.label}: ${f.value}`).join("   |   "));
    }
    doc.fillColor("#000");
    doc.moveDown(0.75);

    const startX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = usableWidth / table.columns.length;
    const rowHeight = 16;

    function drawHeader(y: number) {
      doc.fontSize(8).font("Helvetica-Bold");
      table.columns.forEach((col, i) => {
        doc.text(col.label, startX + i * colWidth, y, {
          width: colWidth - 4,
          align: col.align ?? "left",
        });
      });
      doc.font("Helvetica");
    }

    let y = doc.y;
    drawHeader(y);
    y += rowHeight;
    doc
      .moveTo(startX, y - 2)
      .lineTo(startX + usableWidth, y - 2)
      .strokeColor("#ccc")
      .stroke();

    doc.fontSize(8);
    for (const row of table.rows) {
      if (y > doc.page.height - doc.page.margins.bottom - rowHeight) {
        doc.addPage({ margin: 36, size: "A4", layout: "landscape" });
        y = doc.page.margins.top;
        drawHeader(y);
        y += rowHeight;
      }
      table.columns.forEach((col, i) => {
        doc.text(String(row[col.key] ?? ""), startX + i * colWidth, y, {
          width: colWidth - 4,
          align: col.align ?? "left",
        });
      });
      y += rowHeight;
    }

    if (table.summary.length > 0) {
      y += 8;
      if (y > doc.page.height - doc.page.margins.bottom - rowHeight * (table.summary.length + 2)) {
        doc.addPage({ margin: 36, size: "A4", layout: "landscape" });
        y = doc.page.margins.top;
      }
      doc.font("Helvetica-Bold").text("Summary", startX, y);
      y += rowHeight;
      doc.font("Helvetica");
      for (const item of table.summary) {
        doc.text(`${item.label}: ${item.value}`, startX, y);
        y += rowHeight;
      }
    }

    doc.end();
  });
}
