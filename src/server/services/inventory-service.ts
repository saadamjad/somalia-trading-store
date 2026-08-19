import type { InventoryChangeReason, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";
import { inventoryRepository } from "@/server/repositories/inventory-repository";
import { toDomainProduct } from "@/server/services/product-mappers";

export class InventoryNotFoundError extends Error {
  constructor(productId: string) {
    super(`No inventory record exists for product: ${productId}`);
    this.name = "InventoryNotFoundError";
  }
}

export class InsufficientStockError extends Error {
  constructor(productId: string, requested: number, available: number) {
    super(
      `Cannot adjust stock for product ${productId} by ${requested}: only ${available} on hand.`
    );
    this.name = "InsufficientStockError";
  }
}

export interface StockAdjustment {
  productId: string;
  quantity: number;
  lowStockThreshold: number;
  updatedAt: Date;
}

export type StockStatus = "out_of_stock" | "low_stock" | "in_stock";

export function toStockStatus(quantity: number, lowStockThreshold: number): StockStatus {
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

export interface StockAdjustmentResult {
  inventory: StockAdjustment;
  transaction: {
    id: string;
    productId: string;
    previousQuantity: number;
    adjustment: number;
    newQuantity: number;
    reason: InventoryChangeReason;
    note: string | null;
    actorId: string;
    createdAt: Date;
  };
}

/**
 * Inventory service — stock adjustment is the one method that matters here, and it's
 * deliberately generic (a signed delta + a reason + an actor) rather than shaped around
 * "the admin manual-adjust form" specifically, so Phase 8 (checkout) can call the same
 * method to decrement stock on order creation (with reason: ORDER_PLACED) without any
 * changes here — only a new caller.
 *
 * Concurrency safety: the actual negative-stock guard is a single atomic conditional
 * UPDATE in the repository layer (`WHERE quantity + delta >= 0`), executed inside a
 * Prisma `$transaction`. That's what prevents two concurrent "decrement by
 * quantity-on-hand" calls from both succeeding — see inventory-repository.ts and the
 * concurrency test in inventory-service.test.ts. This method never trusts a
 * client-supplied "new quantity" as ground truth; callers only ever supply a delta and
 * everything is re-validated against the current DB row inside the same transaction.
 */
export const inventoryService = {
  /** Admin stock-level view: every product's current quantity, threshold, and status. */
  async getAll() {
    const rows = await inventoryRepository.findAll();
    return rows.map((row) => ({
      productId: row.productId,
      product: toDomainProduct(row.product),
      quantity: row.quantity,
      lowStockThreshold: row.lowStockThreshold,
      status: toStockStatus(row.quantity, row.lowStockThreshold),
      updatedAt: row.updatedAt.toISOString(),
    }));
  },

  async getForProduct(productId: string) {
    const inventory = await inventoryRepository.findByProductId(productId);
    if (!inventory) throw new InventoryNotFoundError(productId);
    return {
      productId: inventory.productId,
      product: toDomainProduct(inventory.product),
      quantity: inventory.quantity,
      lowStockThreshold: inventory.lowStockThreshold,
      status: toStockStatus(inventory.quantity, inventory.lowStockThreshold),
      updatedAt: inventory.updatedAt.toISOString(),
    };
  },

  /**
   * Public-safe stock read: "is there enough of this product for a customer's cart" is
   * not an admin action, unlike `getAll`/`getForProduct` (which return admin-shaped
   * data and are called from permission-gated routes). No permission check here —
   * callers are expected to be things like cart-service.validateStock. Returns a Map
   * keyed by productId; a product with no Inventory row (or not in `productIds`) is
   * simply absent from the map — callers treat "absent" as "0 available".
   */
  async getAvailableQuantities(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();
    const rows = await inventoryRepository.findManyByProductIds(productIds);
    return new Map(rows.map((row) => [row.productId, row.quantity]));
  },

  async getTransactionsForProduct(productId: string, limit?: number) {
    return inventoryRepository.listTransactionsForProduct(productId, limit);
  },

  /**
   * Applies a signed `delta` (positive = restock/increase, negative = decrement) to a
   * product's on-hand quantity. Throws `InventoryNotFoundError` if the product has no
   * Inventory row, or `InsufficientStockError` if the adjustment would push quantity
   * below zero. Writes exactly one InventoryTransaction row per call, atomically with
   * the quantity update (single Prisma `$transaction` — both succeed or both roll back).
   *
   * Accepts an optional `tx` (an already-open `Prisma.TransactionClient`) so a caller
   * that needs this adjustment to be part of a larger atomic operation — e.g.
   * order-service.createOrder, which must create the Order + OrderItems, decrement
   * stock, and clear the cart all-or-nothing — can pass its own transaction down
   * instead of letting this method open a second, independent one. This matters because
   * Prisma's interactive transactions do not nest: calling `prisma.$transaction` again
   * from inside another `prisma.$transaction` callback runs on a separate connection as
   * an unrelated transaction, so if the outer transaction later rolled back, an
   * inventory decrement done via a nested `prisma.$transaction` would NOT roll back
   * with it. Passing `tx` through avoids that: every query in this method then runs on
   * the caller's single connection/transaction. When `tx` is omitted (the normal admin-
   * adjustment call path), this method opens its own transaction exactly as before.
   */
  async adjustStock(
    input: {
      productId: string;
      delta: number;
      reason: InventoryChangeReason;
      actorId: string;
      note?: string;
    },
    tx?: Prisma.TransactionClient
  ): Promise<StockAdjustmentResult> {
    const { productId, delta, reason, actorId, note } = input;

    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error("Adjustment delta must be a non-zero integer.");
    }

    const run = async (client: Prisma.TransactionClient) => {
      const product = await client.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new InventoryNotFoundError(productId);
      }

      const existing = await inventoryRepository.findByProductIdTx(client, productId);
      if (!existing) {
        throw new InventoryNotFoundError(productId);
      }

      const newQuantity = await inventoryRepository.applyAdjustment(client, productId, delta);
      if (newQuantity === null) {
        throw new InsufficientStockError(productId, delta, existing.quantity);
      }

      const previousQuantity = newQuantity - delta;

      const transaction = await inventoryRepository.createTransactionTx(client, {
        inventoryId: existing.id,
        productId,
        previousQuantity,
        adjustment: delta,
        newQuantity,
        reason,
        note: note ?? null,
        actorId,
      });

      return {
        inventory: {
          productId,
          quantity: newQuantity,
          lowStockThreshold: existing.lowStockThreshold,
          updatedAt: transaction.createdAt,
        },
        transaction,
      };
    };

    if (tx) {
      return run(tx);
    }
    return prisma.$transaction(run);
  },
};
