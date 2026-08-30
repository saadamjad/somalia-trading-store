import type { InventoryChangeReason, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";
import { productVariantRepository } from "@/server/repositories/product-variant-repository";
import { variantInventoryRepository } from "@/server/repositories/variant-inventory-repository";
import { productRepository } from "@/server/repositories/product-repository";
import { toStockStatus } from "@/server/services/inventory-service";

export class ProductNotFoundForVariantError extends Error {
  constructor() {
    super("Product not found.");
    this.name = "ProductNotFoundForVariantError";
  }
}

export class VariantNotFoundError extends Error {
  constructor() {
    super("Product variant not found.");
    this.name = "VariantNotFoundError";
  }
}

export class VariantHasOrdersError extends Error {
  constructor() {
    super("This variant has existing orders and can't be deleted — deactivate it instead.");
    this.name = "VariantHasOrdersError";
  }
}

export class VariantInsufficientStockError extends Error {
  constructor(variantId: string, requested: number, available: number) {
    super(`Cannot adjust stock for variant ${variantId} by ${requested}: only ${available} on hand.`);
    this.name = "VariantInsufficientStockError";
  }
}

export interface VariantView {
  id: string;
  productId: string;
  sku: string;
  attributes: Record<string, string>;
  label: string;
  price: number | null;
  image: string | null;
  active: boolean;
  quantity: number;
  lowStockThreshold: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

/** Renders `{"size":"M","color":"Black"}` as `"Black / M"` — deterministic ordering
 * so the same attribute set always renders the same label (used both for the admin
 * list and the OrderItem.variantLabel historical snapshot). */
export function variantLabel(attributes: Record<string, unknown>): string {
  return Object.keys(attributes)
    .sort()
    .map((key) => String(attributes[key]))
    .join(" / ");
}

function toView(
  variant: {
    id: string;
    productId: string;
    sku: string;
    attributes: Prisma.JsonValue;
    price: Prisma.Decimal | null;
    image: string | null;
    active: boolean;
  },
  inventory: { quantity: number; lowStockThreshold: number } | null
): VariantView {
  const attributes = (variant.attributes ?? {}) as Record<string, string>;
  const quantity = inventory?.quantity ?? 0;
  const lowStockThreshold = inventory?.lowStockThreshold ?? 10;
  return {
    id: variant.id,
    productId: variant.productId,
    sku: variant.sku,
    attributes,
    label: variantLabel(attributes),
    price: variant.price !== null ? Number(variant.price) : null,
    image: variant.image,
    active: variant.active,
    quantity,
    lowStockThreshold,
    status: toStockStatus(quantity, lowStockThreshold),
  };
}

export const productVariantService = {
  async listForProduct(productId: string): Promise<VariantView[]> {
    const variants = await productVariantRepository.findByProductId(productId);
    if (variants.length === 0) return [];
    const inventories = await variantInventoryRepository.findManyByVariantIds(
      variants.map((v) => v.id)
    );
    const inventoryByVariant = new Map(inventories.map((i) => [i.variantId, i]));
    return variants.map((v) => toView(v, inventoryByVariant.get(v.id) ?? null));
  },

  /** Public batch lookup by id, with live price/stock — used by the client cart's
   * line-item resolution (a variant already in someone's cart must still resolve even
   * if it was deactivated after being added, same as a plain product would). */
  async getByIds(ids: string[]): Promise<VariantView[]> {
    if (ids.length === 0) return [];
    const variants = await productVariantRepository.findByIds(ids);
    if (variants.length === 0) return [];
    const inventories = await variantInventoryRepository.findManyByVariantIds(ids);
    const inventoryByVariant = new Map(inventories.map((i) => [i.variantId, i]));
    return variants.map((v) => toView(v, inventoryByVariant.get(v.id) ?? null));
  },

  /** Storefront-facing: active variants only, with live stock. */
  async listActiveForProduct(productId: string): Promise<VariantView[]> {
    const variants = await productVariantRepository.findActiveByProductId(productId);
    if (variants.length === 0) return [];
    const inventories = await variantInventoryRepository.findManyByVariantIds(
      variants.map((v) => v.id)
    );
    const inventoryByVariant = new Map(inventories.map((i) => [i.variantId, i]));
    return variants.map((v) => toView(v, inventoryByVariant.get(v.id) ?? null));
  },

  /**
   * Creates a variant + its initial VariantInventory row atomically. Duplicate
   * attribute-combination prevention for the same product is a service-layer check
   * (not a DB constraint — see ProductVariant's schema comment): an admin-facing
   * catalog operation, not a customer-facing concurrency-sensitive race.
   */
  async create(input: {
    productId: string;
    sku: string;
    attributes: Record<string, string>;
    price?: number | null;
    image?: string | null;
    initialStock: number;
    lowStockThreshold?: number;
  }): Promise<VariantView> {
    const product = await productRepository.findById(input.productId);
    if (!product) throw new ProductNotFoundForVariantError();

    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          productId: input.productId,
          sku: input.sku,
          attributes: input.attributes,
          price: input.price ?? null,
          image: input.image ?? null,
        },
      });
      await variantInventoryRepository.createTx(tx, created.id, input.initialStock, input.lowStockThreshold);
      return created;
    });

    const inventory = await variantInventoryRepository.findByVariantId(variant.id);
    return toView(variant, inventory);
  },

  async update(
    id: string,
    input: {
      sku?: string;
      attributes?: Record<string, string>;
      price?: number | null;
      image?: string | null;
      active?: boolean;
    }
  ): Promise<VariantView> {
    const existing = await productVariantRepository.findById(id);
    if (!existing) throw new VariantNotFoundError();

    const updated = await productVariantRepository.update(id, input);
    const inventory = await variantInventoryRepository.findByVariantId(id);
    return toView(updated, inventory);
  },

  /** Hard-delete only if no order has ever referenced this variant (historical
   * order-item snapshots must survive — same principle as products, see D-... and
   * `docs/ai/BUSINESS_RULES.md`). Deactivate (`active: false`) otherwise. */
  async delete(id: string): Promise<void> {
    const existing = await productVariantRepository.findById(id);
    if (!existing) throw new VariantNotFoundError();

    const orderItemCount = await productVariantRepository.countOrderItemsForVariant(id);
    if (orderItemCount > 0) throw new VariantHasOrdersError();

    await productVariantRepository.delete(id);
  },

  /** Mirrors inventoryService.adjustStock exactly (atomic conditional UPDATE, same
   * transaction-passthrough contract) for the variant stock path. */
  async adjustStock(
    input: {
      variantId: string;
      delta: number;
      reason: InventoryChangeReason;
      actorId: string;
      note?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const { variantId, delta, reason, actorId, note } = input;
    if (!Number.isInteger(delta) || delta === 0) {
      throw new Error("Adjustment delta must be a non-zero integer.");
    }

    const run = async (client: Prisma.TransactionClient) => {
      const variant = await client.productVariant.findUnique({ where: { id: variantId } });
      if (!variant) throw new VariantNotFoundError();

      const existing = await variantInventoryRepository.findByVariantIdTx(client, variantId);
      if (!existing) throw new VariantNotFoundError();

      const newQuantity = await variantInventoryRepository.applyAdjustment(client, variantId, delta);
      if (newQuantity === null) {
        throw new VariantInsufficientStockError(variantId, delta, existing.quantity);
      }

      const previousQuantity = newQuantity - delta;

      const transaction = await variantInventoryRepository.createTransactionTx(client, {
        inventoryId: existing.id,
        variantId,
        previousQuantity,
        adjustment: delta,
        newQuantity,
        reason,
        note: note ?? null,
        actorId,
      });

      return { variantId, quantity: newQuantity, transaction };
    };

    if (tx) return run(tx);
    return prisma.$transaction(run);
  },
};
