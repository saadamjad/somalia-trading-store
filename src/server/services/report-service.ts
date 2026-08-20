import { orderRepository, type AdminOrderListFilters } from "@/server/repositories/order-repository";
import { refundRequestRepository } from "@/server/repositories/refund-request-repository";
import { quoteRepository } from "@/server/repositories/quote-repository";
import { reportRepository } from "@/server/repositories/report-repository";
import { inventoryService } from "@/server/services/inventory-service";
import type { ReportQueryInput, ReportType } from "@/lib/validations/reports";
import type { QuoteStatus, RefundRequestStatus } from "@/generated/prisma/client";

/** A row is a flat map of column key -> displayable value — deliberately generic so a
 * single set of CSV/XLSX/PDF exporters (src/server/lib/export/) can serialize any
 * report without per-report-type export code. */
export type ReportRow = Record<string, string | number>;

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface ReportTable {
  type: ReportType;
  title: string;
  generatedAt: string;
  /** Human-readable applied filters, for display above the table and in export headers. */
  appliedFilters: { label: string; value: string }[];
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Small set of headline numbers shown above the table (e.g. totals, counts). Never
   * contains anything implying payment was collected — see the "not revenue" comments
   * throughout this file, matching docs/DECISIONS.md D-007 and the Phase 13 dashboard's
   * convention. */
  summary: { label: string; value: string }[];
}

const REFUND_STATUSES: RefundRequestStatus[] = ["REQUESTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];
const QUOTE_STATUSES: QuoteStatus[] = ["NEW", "REVIEWING", "QUOTED", "ACCEPTED", "DECLINED", "CONVERTED"];

function fmtDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace("T", " ").slice(0, 19);
}

function appliedFiltersFrom(query: ReportQueryInput): { label: string; value: string }[] {
  const filters: { label: string; value: string }[] = [];
  if (query.dateFrom) filters.push({ label: "From", value: fmtDate(query.dateFrom) });
  if (query.dateTo) filters.push({ label: "To", value: fmtDate(query.dateTo) });
  if (query.orderStatus) filters.push({ label: "Order status", value: query.orderStatus });
  if (query.customer) filters.push({ label: "Customer", value: query.customer });
  if (query.stockStatus && query.stockStatus !== "all") {
    filters.push({ label: "Stock status", value: query.stockStatus });
  }
  if (query.refundStatus) filters.push({ label: "Refund status", value: query.refundStatus });
  if (query.quoteStatus) filters.push({ label: "Quote status", value: query.quoteStatus });
  return filters;
}

/** Cap on rows pulled for a report/export — generous for this project's scale (a
 * report is a point-in-time export, not a paginated UI list) while still bounding a
 * single query. */
const REPORT_ROW_CAP = 5000;

/**
 * Builds the data + metadata for one report type. Reuses existing repository/service
 * methods wherever their filter shape already covers what a report needs (orders via
 * `orderRepository.adminFindMany`, inventory stock levels via `inventoryService.getAll`)
 * and adds new aggregation queries only where nothing reusable exists (product sales,
 * orders-by-customer, all-product inventory transactions — see report-repository.ts).
 *
 * No permission check here — matches this codebase's convention (permission checks
 * live at the route/page, not the service); see `/api/admin/reports` and
 * `/admin/reports/page.tsx`.
 */
export const reportService = {
  async build(query: ReportQueryInput): Promise<ReportTable> {
    switch (query.type) {
      case "orders":
        return buildOrdersReport(query);
      case "products":
        return buildProductsReport(query);
      case "customers":
        return buildCustomersReport(query);
      case "inventory":
        return buildInventoryReport(query);
      case "refunds":
        return buildRefundsReport(query);
      case "quotes":
        return buildQuotesReport(query);
    }
  },
};

async function buildOrdersReport(query: ReportQueryInput): Promise<ReportTable> {
  const filters: AdminOrderListFilters = {
    status: query.orderStatus,
    customerQuery: query.customer,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  };

  const { items, total } = await orderRepository.adminFindMany({
    filters,
    sortBy: "createdAt",
    sortDir: "desc",
    page: 1,
    pageSize: REPORT_ROW_CAP,
  });

  const orderValueTotal = items.reduce((sum, o) => sum + Number(o.total), 0);

  return {
    type: "orders",
    title: "Order report",
    generatedAt: new Date().toISOString(),
    appliedFilters: appliedFiltersFrom(query),
    columns: [
      { key: "orderNumber", label: "Order #" },
      { key: "customerName", label: "Customer" },
      { key: "customerEmail", label: "Email" },
      { key: "status", label: "Status" },
      { key: "paymentStatus", label: "Payment status" },
      { key: "itemCount", label: "Items", align: "right" },
      { key: "total", label: "Order value", align: "right" },
      { key: "currency", label: "Currency" },
      { key: "createdAt", label: "Date" },
    ],
    rows: items.map((order) => ({
      orderNumber: order.orderNumber,
      customerName: order.user.name,
      customerEmail: order.user.email,
      status: order.status,
      paymentStatus: order.paymentStatus,
      itemCount: order._count.items,
      total: Number(order.total),
      currency: order.currency,
      createdAt: fmtDateTime(order.createdAt),
    })),
    summary: [
      { label: "Orders", value: String(total) },
      // Deliberately labeled "order VALUE", never "Revenue" — no payment gateway
      // exists yet (D-007), every order has paymentStatus NOT_PAID.
      {
        label: "Total order value (orders placed — no payments have been collected)",
        value: orderValueTotal.toFixed(2),
      },
    ],
  };
}

async function buildProductsReport(query: ReportQueryInput): Promise<ReportTable> {
  const rows = await reportRepository.productSales({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    orderStatus: query.orderStatus,
  });

  const totalQuantity = rows.reduce((sum, r) => sum + r.quantitySold, 0);

  return {
    type: "products",
    title: "Product sales report",
    generatedAt: new Date().toISOString(),
    appliedFilters: appliedFiltersFrom(query),
    columns: [
      { key: "productName", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category" },
      { key: "quantitySold", label: "Qty sold", align: "right" },
      { key: "orderLineCount", label: "Orders containing", align: "right" },
      { key: "totalValue", label: "Order line value", align: "right" },
      { key: "currency", label: "Currency" },
    ],
    rows: rows.map((row) => ({
      productName: row.productName,
      sku: row.sku ?? "",
      category: row.category ?? "",
      quantitySold: row.quantitySold,
      orderLineCount: row.orderLineCount,
      totalValue: row.totalValue,
      currency: row.currency,
    })),
    summary: [
      { label: "Products with sales", value: String(rows.length) },
      { label: "Total units sold", value: String(totalQuantity) },
    ],
  };
}

async function buildCustomersReport(query: ReportQueryInput): Promise<ReportTable> {
  const rows = await reportRepository.ordersByCustomer({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  const totalOrders = rows.reduce((sum, r) => sum + r.orderCount, 0);
  const totalValue = rows.reduce((sum, r) => sum + r.orderValue, 0);

  return {
    type: "customers",
    title: "Customer report",
    generatedAt: new Date().toISOString(),
    appliedFilters: appliedFiltersFrom(query),
    columns: [
      { key: "customerName", label: "Customer" },
      { key: "customerEmail", label: "Email" },
      { key: "orderCount", label: "Orders", align: "right" },
      { key: "orderValue", label: "Order value", align: "right" },
    ],
    rows: rows.map((row) => ({
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      orderCount: row.orderCount,
      orderValue: row.orderValue,
    })),
    summary: [
      { label: "Customers with orders", value: String(rows.length) },
      { label: "Total orders", value: String(totalOrders) },
      {
        label: "Total order value (orders placed — no payments have been collected)",
        value: totalValue.toFixed(2),
      },
    ],
  };
}

async function buildInventoryReport(query: ReportQueryInput): Promise<ReportTable> {
  const allStock = await inventoryService.getAll();
  const stock =
    query.stockStatus === "all"
      ? allStock
      : allStock.filter((row) => row.status === query.stockStatus);

  const lowStockCount = allStock.filter((r) => r.status === "low_stock").length;
  const outOfStockCount = allStock.filter((r) => r.status === "out_of_stock").length;

  const transactions = await reportRepository.listAllTransactions({
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: REPORT_ROW_CAP,
  });

  // Inventory report has two logical tables (current stock levels + recent
  // transactions); both are flattened into one row set here, distinguished by a
  // `section` column, so this fits the same single-table ReportTable shape every other
  // report uses and the same generic exporters can serialize it without special-casing.
  const stockRows: ReportRow[] = stock.map((row) => ({
    section: "Stock level",
    product: row.product.name,
    sku: row.product.sku ?? "",
    quantity: row.quantity,
    lowStockThreshold: row.lowStockThreshold,
    status: row.status,
    reason: "",
    adjustment: "",
    actor: "",
    date: fmtDateTime(row.updatedAt),
  }));

  const transactionRows: ReportRow[] = transactions.map((tx) => ({
    section: "Recent transaction",
    product: tx.product.name,
    sku: tx.product.sku ?? "",
    quantity: tx.newQuantity,
    lowStockThreshold: "",
    status: "",
    reason: tx.reason,
    adjustment: tx.adjustment > 0 ? `+${tx.adjustment}` : String(tx.adjustment),
    actor: tx.actor.name,
    date: fmtDateTime(tx.createdAt),
  }));

  return {
    type: "inventory",
    title: "Inventory report",
    generatedAt: new Date().toISOString(),
    appliedFilters: appliedFiltersFrom(query),
    columns: [
      { key: "section", label: "Section" },
      { key: "product", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Quantity", align: "right" },
      { key: "lowStockThreshold", label: "Low stock threshold", align: "right" },
      { key: "status", label: "Status" },
      { key: "reason", label: "Reason" },
      { key: "adjustment", label: "Adjustment" },
      { key: "actor", label: "Actor" },
      { key: "date", label: "Date" },
    ],
    rows: [...stockRows, ...transactionRows],
    summary: [
      { label: "Products tracked", value: String(allStock.length) },
      { label: "Low stock", value: String(lowStockCount) },
      { label: "Out of stock", value: String(outOfStockCount) },
      { label: "Recent transactions", value: String(transactions.length) },
    ],
  };
}

async function buildRefundsReport(query: ReportQueryInput): Promise<ReportTable> {
  const { items } = await refundRequestRepository.adminFindMany({
    filters: { status: query.refundStatus },
    page: 1,
    pageSize: REPORT_ROW_CAP,
  });

  const dateFiltered = filterByDateRange(items, (item) => item.createdAt, query.dateFrom, query.dateTo);

  const byStatus = Object.fromEntries(REFUND_STATUSES.map((s) => [s, 0])) as Record<
    RefundRequestStatus,
    number
  >;
  for (const item of dateFiltered) byStatus[item.status]++;

  return {
    type: "refunds",
    title: "Refund request report",
    generatedAt: new Date().toISOString(),
    appliedFilters: appliedFiltersFrom(query),
    columns: [
      { key: "orderNumber", label: "Order #" },
      { key: "requestedBy", label: "Requested by" },
      { key: "reasonCategory", label: "Reason" },
      { key: "status", label: "Status" },
      { key: "reviewedBy", label: "Reviewed by" },
      { key: "requestedAt", label: "Requested" },
      { key: "reviewedAt", label: "Reviewed" },
    ],
    rows: dateFiltered.map((item) => ({
      orderNumber: item.order.orderNumber,
      requestedBy: item.requestedBy.name,
      reasonCategory: item.reasonCategory,
      status: item.status,
      reviewedBy: item.reviewedBy?.name ?? "",
      requestedAt: fmtDateTime(item.createdAt),
      reviewedAt: item.reviewedAt ? fmtDateTime(item.reviewedAt) : "",
    })),
    summary: [
      { label: "Refund requests", value: String(dateFiltered.length) },
      ...REFUND_STATUSES.map((status) => ({ label: status, value: String(byStatus[status]) })),
    ],
  };
}

async function buildQuotesReport(query: ReportQueryInput): Promise<ReportTable> {
  const { items } = await quoteRepository.adminFindMany({
    filters: { status: query.quoteStatus },
    page: 1,
    pageSize: REPORT_ROW_CAP,
  });

  const dateFiltered = filterByDateRange(items, (item) => item.createdAt, query.dateFrom, query.dateTo);

  const byStatus = Object.fromEntries(QUOTE_STATUSES.map((s) => [s, 0])) as Record<QuoteStatus, number>;
  for (const item of dateFiltered) byStatus[item.status]++;

  const converted = byStatus.CONVERTED;
  const conversionRate =
    dateFiltered.length > 0 ? ((converted / dateFiltered.length) * 100).toFixed(1) + "%" : "n/a";

  return {
    type: "quotes",
    title: "Quote report",
    generatedAt: new Date().toISOString(),
    appliedFilters: appliedFiltersFrom(query),
    columns: [
      { key: "contactName", label: "Contact" },
      { key: "contactEmail", label: "Email" },
      { key: "contactCompany", label: "Company" },
      { key: "status", label: "Status" },
      { key: "itemCount", label: "Items", align: "right" },
      { key: "convertedOrderNumber", label: "Converted order" },
      { key: "createdAt", label: "Date" },
    ],
    rows: dateFiltered.map((item) => ({
      contactName: item.contactName,
      contactEmail: item.contactEmail,
      contactCompany: item.contactCompany ?? "",
      status: item.status,
      itemCount: item.items.length,
      convertedOrderNumber: item.convertedOrder?.orderNumber ?? "",
      createdAt: fmtDateTime(item.createdAt),
    })),
    summary: [
      { label: "Quotes", value: String(dateFiltered.length) },
      { label: "Converted", value: String(converted) },
      { label: "Conversion rate", value: conversionRate },
      ...QUOTE_STATUSES.map((status) => ({ label: status, value: String(byStatus[status]) })),
    ],
  };
}

function filterByDateRange<T>(
  items: T[],
  getDate: (item: T) => Date,
  dateFrom?: Date,
  dateTo?: Date
): T[] {
  if (!dateFrom && !dateTo) return items;
  return items.filter((item) => {
    const d = getDate(item);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });
}
