import { z } from "zod";
import {
  OrderStatus,
  RefundRequestStatus,
  QuoteStatus,
} from "@/generated/prisma/client";

/**
 * Phase 14 — Reports & Analytics. One query schema shared by every report type's page
 * and its export endpoint, so the on-screen table and the exported file are always
 * built from the exact same filtered dataset (spec requirement: exports must match
 * what's on screen). Not every field applies to every report type — each report
 * service method reads only the fields it needs and ignores the rest.
 */
export const REPORT_TYPES = [
  "orders",
  "products",
  "customers",
  "inventory",
  "refunds",
  "quotes",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  orders: "Orders",
  products: "Products (sales)",
  customers: "Customers",
  inventory: "Inventory",
  refunds: "Refund requests",
  quotes: "Quotes",
};

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES).default("orders"),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  /** Orders report only. */
  orderStatus: z.nativeEnum(OrderStatus).optional(),
  /** Orders report only — matches customer name or email. */
  customer: z.string().trim().min(1).optional(),
  /** Inventory report only — filter the stock-levels table. */
  stockStatus: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
  /** Refunds report only. */
  refundStatus: z.nativeEnum(RefundRequestStatus).optional(),
  /** Quotes report only. */
  quoteStatus: z.nativeEnum(QuoteStatus).optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

export const reportExportQuerySchema = reportQuerySchema.extend({
  format: z.enum(EXPORT_FORMATS).default("csv"),
});

export type ReportExportQueryInput = z.infer<typeof reportExportQuerySchema>;
