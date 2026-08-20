import type { ReportTable } from "@/server/services/report-service";

/** Escapes a single CSV field per RFC 4180: wraps in quotes and doubles any embedded
 * quote whenever the value contains a comma, quote, or newline. */
function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Renders a `ReportTable` as CSV text. Only the same fields the on-screen report shows
 * are included (the columns already come pre-shaped by report-service.ts) — no extra
 * internal fields are ever appended here.
 */
export function toCsv(table: ReportTable): string {
  const lines: string[] = [];
  lines.push(`# ${table.title}`);
  lines.push(`# Generated: ${table.generatedAt}`);
  for (const filter of table.appliedFilters) {
    lines.push(`# ${filter.label}: ${filter.value}`);
  }
  lines.push("");

  lines.push(table.columns.map((c) => csvEscape(c.label)).join(","));
  for (const row of table.rows) {
    lines.push(table.columns.map((c) => csvEscape(row[c.key] ?? "")).join(","));
  }

  if (table.summary.length > 0) {
    lines.push("");
    lines.push("# Summary");
    for (const item of table.summary) {
      lines.push(`${csvEscape(item.label)},${csvEscape(item.value)}`);
    }
  }

  return lines.join("\r\n");
}
