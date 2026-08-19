import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

export interface ShippingSnapshot {
  shippingRecipientName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2?: string | null;
  shippingCity: string;
  shippingRegion?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry: string;
}

export interface OrderItemCreateInput {
  productId: string;
  productName: string;
  sku?: string | null;
  unitPrice: Prisma.Decimal | number | string;
  quantity: number;
  lineTotal: Prisma.Decimal | number | string;
}

export interface OrderCreateInput extends ShippingSnapshot {
  orderNumber: string;
  userId: string;
  subtotal: Prisma.Decimal | number | string;
  total: Prisma.Decimal | number | string;
  currency: string;
  customerNote?: string | null;
  items: OrderItemCreateInput[];
}

const withItems = { items: { orderBy: { id: "asc" as const } } };

/**
 * Data access only — Prisma queries, no business rules. Order creation is always
 * called with an explicit `tx` (an already-open `Prisma.TransactionClient`) because it
 * must compose atomically with the inventory decrement and cart clear performed
 * alongside it — see order-service.ts `createOrder`, which owns the single
 * `prisma.$transaction` these all run inside.
 */
export const orderRepository = {
  createTx(tx: Prisma.TransactionClient, data: OrderCreateInput) {
    const { items, ...orderData } = data;
    return tx.order.create({
      data: {
        ...orderData,
        items: { create: items },
      },
      include: withItems,
    });
  },

  findAllForUser(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      include: withItems,
      orderBy: { createdAt: "desc" },
    });
  },

  /** Returns the order only if it belongs to `userId` — the ownership boundary. */
  findByIdForUser(id: string, userId: string) {
    return prisma.order.findFirst({ where: { id, userId }, include: withItems });
  },

  findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({ where: { orderNumber }, include: withItems });
  },
};
