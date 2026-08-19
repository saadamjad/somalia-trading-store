import type { InventoryChangeReason, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

const withProduct = { product: { include: { category: true } } } as const;

export interface InventoryTransactionCreateInput {
  inventoryId: string;
  productId: string;
  previousQuantity: number;
  adjustment: number;
  newQuantity: number;
  reason: InventoryChangeReason;
  note?: string | null;
  actorId: string;
}

/**
 * Data access only — Prisma queries, no business rules. The atomic conditional update
 * in `applyAdjustment` is the one piece of "logic" here, and it's a DB-level guarantee
 * (a single UPDATE statement), not an application-level invariant — see
 * inventory-service.ts for the invariant enforcement (transaction orchestration,
 * business errors) that calls this repository.
 */
export const inventoryRepository = {
  findAll() {
    return prisma.inventory.findMany({
      include: withProduct,
      orderBy: { updatedAt: "desc" },
    });
  },

  findByProductId(productId: string) {
    return prisma.inventory.findUnique({ where: { productId }, include: withProduct });
  },

  /**
   * Public-safe read: just productId + quantity, for many products at once. No admin
   * fields (thresholds, transaction history), so this is fine to call without the
   * `inventory.view` permission — see inventory-service.ts `getAvailableQuantities`.
   */
  findManyByProductIds(productIds: string[]) {
    return prisma.inventory.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, quantity: true },
    });
  },

  findByProductIdTx(tx: Prisma.TransactionClient, productId: string) {
    return tx.inventory.findUnique({ where: { productId } });
  },

  /**
   * Atomically applies `delta` to the Inventory row for `productId`, guarding against
   * negative stock in the same SQL statement (`WHERE quantity + delta >= 0`) rather
   * than via a separate read-then-write — this is what makes the adjustment safe under
   * concurrent requests: Postgres serializes concurrent UPDATEs to the same row, so the
   * second of two racing adjustments re-evaluates the WHERE clause against the first
   * adjustment's already-committed result. Returns the new quantity, or `null` if no
   * row matched (either the product has no Inventory row, or the adjustment would have
   * gone negative — the caller disambiguates via a prior existence check).
   */
  async applyAdjustment(
    tx: Prisma.TransactionClient,
    productId: string,
    delta: number
  ): Promise<number | null> {
    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      UPDATE "Inventory"
      SET "quantity" = "quantity" + ${delta}, "updatedAt" = now()
      WHERE "productId" = ${productId} AND "quantity" + ${delta} >= 0
      RETURNING "quantity"
    `;
    return rows.length > 0 ? rows[0].quantity : null;
  },

  createTransactionTx(tx: Prisma.TransactionClient, data: InventoryTransactionCreateInput) {
    return tx.inventoryTransaction.create({ data });
  },

  listTransactionsForProduct(productId: string, limit = 50) {
    return prisma.inventoryTransaction.findMany({
      where: { productId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
