import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/**
 * Centralizes the status -> Badge variant color mapping that was previously
 * copy-pasted (byte-identical in places, e.g. admin/quotes and account/quotes)
 * across admin/orders, admin/quotes, admin/refunds, admin/inventory, and
 * account/quotes. Faithfully reproduces each existing mapping — no color
 * changes, just one source of truth.
 */
const ORDER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "outline",
  CONFIRMED: "secondary",
  PROCESSING: "secondary",
  SHIPPED: "secondary",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

const PAYMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NOT_PAID: "outline",
  PAID: "success",
  REFUNDED: "secondary",
  FAILED: "destructive",
};

const QUOTE_STATUS_VARIANT: Record<string, BadgeVariant> = {
  NEW: "outline",
  REVIEWING: "secondary",
  QUOTED: "secondary",
  ACCEPTED: "success",
  DECLINED: "destructive",
  CONVERTED: "success",
};

const REFUND_STATUS_VARIANT: Record<string, BadgeVariant> = {
  REQUESTED: "outline",
  UNDER_REVIEW: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
};

const INVENTORY_STATUS_VARIANT: Record<string, BadgeVariant> = {
  in_stock: "success",
  low_stock: "secondary",
  out_of_stock: "destructive",
};

export function getOrderStatusVariant(status: string): BadgeVariant {
  return ORDER_STATUS_VARIANT[status] ?? "outline";
}

export function getPaymentStatusVariant(status: string): BadgeVariant {
  return PAYMENT_STATUS_VARIANT[status] ?? "outline";
}

export function getQuoteStatusVariant(status: string): BadgeVariant {
  return QUOTE_STATUS_VARIANT[status] ?? "outline";
}

export function getRefundStatusVariant(status: string): BadgeVariant {
  return REFUND_STATUS_VARIANT[status] ?? "outline";
}

export function getInventoryStatusVariant(status: string): BadgeVariant {
  return INVENTORY_STATUS_VARIANT[status] ?? "outline";
}
