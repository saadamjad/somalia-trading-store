import type { InventoryChangeReason, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

const withVariant = { variant: { include: { product: { include: { category: true } } } } } as const;

export interface VariantInventoryTransactionCreateInput {
  inventoryId: string;
  variantId: string;
  previousQuantity: number;
  adjustment: number;
  newQuantity: number;
  reason: InventoryChangeReason;
  note?: string | null;
  actorId: string;
}

/**
 * Mirrors inventory-repository.ts exactly (same atomic conditional-UPDATE pattern in
 * `applyAdjustment`, same query shapes) for the variant stock path — see
 * ProductVariant's schema comment for why this is a parallel repository rather than a
 * nullable-variantId retrofit of the original.
 */
export const variantInventoryRepository = {
  findAll() {
    return prisma.variantInventory.findMany({
      include: withVariant,
      orderBy: { updatedAt: "desc" },
    });
  },

  findByVariantId(variantId: string) {
    return prisma.variantInventory.findUnique({ where: { variantId }, include: withVariant });
  },

  findManyByVariantIds(variantIds: string[]) {
    return prisma.variantInventory.findMany({
      where: { variantId: { in: variantIds } },
      select: { variantId: true, quantity: true, lowStockThreshold: true },
    });
  },

  findByVariantIdTx(tx: Prisma.TransactionClient, variantId: string) {
    return tx.variantInventory.findUnique({ where: { variantId } });
  },

  createTx(tx: Prisma.TransactionClient, variantId: string, quantity: number, lowStockThreshold?: number) {
    return tx.variantInventory.create({
      data: { variantId, quantity, ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}) },
    });
  },

  async applyAdjustment(
    tx: Prisma.TransactionClient,
    variantId: string,
    delta: number
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      UPDATE "VariantInventory"
      SET "quantity" = "quantity" + ${delta}, "updatedAt" = now()
      WHERE "variantId" = ${variantId} AND "quantity" + ${delta} >= 0
      RETURNING "quantity"
    `;
    return rows.length > 0 ? rows[0].quantity : null;
  },

  createTransactionTx(tx: Prisma.TransactionClient, data: VariantInventoryTransactionCreateInput) {
    return tx.variantInventoryTransaction.create({ data });
  },

  listTransactionsForVariant(variantId: string, limit = 50) {
    return prisma.variantInventoryTransaction.findMany({
      where: { variantId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
