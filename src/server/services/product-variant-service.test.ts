import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import {
  productVariantService,
  VariantNotFoundError,
  VariantInsufficientStockError,
  ProductNotFoundForVariantError,
} from "@/server/services/product-variant-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const productIds: string[] = [];
const userIds: string[] = [];

async function makeActor(label: string) {
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
  const user = await prisma.user.create({
    data: {
      email: `variant-service-${label}-${runId}@example.test`,
      passwordHash: "not-a-real-hash",
      name: `Variant Service Test Actor (${label})`,
      roleId: customerRole.id,
    },
  });
  userIds.push(user.id);
  return user.id;
}

async function makeProduct(label: string, price = "50.00") {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `variant-service-test-${label}-${runId}`,
      name: `Variant Service Test Product (${label})`,
      description: "Test fixture product for variant service tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price,
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  return product.id;
}

describe("productVariantService", () => {
  afterAll(async () => {
    await prisma.variantInventoryTransaction.deleteMany({ where: { variant: { productId: { in: productIds } } } });
    await prisma.variantInventory.deleteMany({ where: { variant: { productId: { in: productIds } } } });
    await prisma.productVariant.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("creates a variant with its initial stock atomically, and derives its label from attributes", async () => {
    const productId = await makeProduct("create");

    const variant = await productVariantService.create({
      productId,
      sku: `SKU-CREATE-${runId}`,
      attributes: { size: "M", color: "Black" },
      initialStock: 20,
    });

    expect(variant.label).toBe("Black / M"); // sorted by attribute key: color, size
    expect(variant.quantity).toBe(20);
    expect(variant.status).toBe("in_stock");
    expect(variant.price).toBeNull(); // no override — falls back to product.price at checkout
  });

  it("throws ProductNotFoundForVariantError for a non-existent product", async () => {
    await expect(
      productVariantService.create({
        productId: "does-not-exist",
        sku: `SKU-MISSING-${runId}`,
        attributes: { size: "S" },
        initialStock: 5,
      })
    ).rejects.toThrow(ProductNotFoundForVariantError);
  });

  it("applies a price override that differs from the parent product's price", async () => {
    const productId = await makeProduct("price-override", "50.00");
    const variant = await productVariantService.create({
      productId,
      sku: `SKU-PRICE-${runId}`,
      attributes: { size: "L" },
      price: 65,
      initialStock: 5,
    });
    expect(variant.price).toBe(65);
  });

  it("deactivating a variant (active: false) keeps it out of listActiveForProduct but visible in listForProduct", async () => {
    const productId = await makeProduct("deactivate");
    const variant = await productVariantService.create({
      productId,
      sku: `SKU-DEACTIVATE-${runId}`,
      attributes: { size: "S" },
      initialStock: 5,
    });

    await productVariantService.update(variant.id, { active: false });

    const active = await productVariantService.listActiveForProduct(productId);
    expect(active.find((v) => v.id === variant.id)).toBeUndefined();

    const all = await productVariantService.listForProduct(productId);
    expect(all.find((v) => v.id === variant.id)?.active).toBe(false);
  });

  it("throws VariantNotFoundError when updating a non-existent variant", async () => {
    await expect(productVariantService.update("does-not-exist", { active: false })).rejects.toThrow(
      VariantNotFoundError
    );
  });

  it("adjustStock rejects an adjustment that would push quantity negative, and makes no change", async () => {
    const actorId = await makeActor("reject-negative");
    const productId = await makeProduct("reject-negative");
    const variant = await productVariantService.create({
      productId,
      sku: `SKU-REJECT-${runId}`,
      attributes: { size: "M" },
      initialStock: 5,
    });

    await expect(
      productVariantService.adjustStock({
        variantId: variant.id,
        delta: -10,
        reason: "MANUAL_ADJUSTMENT",
        actorId,
      })
    ).rejects.toThrow(VariantInsufficientStockError);

    const reloaded = await productVariantService.listForProduct(productId);
    expect(reloaded.find((v) => v.id === variant.id)?.quantity).toBe(5);
  });

  it("adjustStock writes exactly one VariantInventoryTransaction row per call, atomically with the quantity update", async () => {
    const actorId = await makeActor("transaction-log");
    const productId = await makeProduct("transaction-log");
    const variant = await productVariantService.create({
      productId,
      sku: `SKU-TXLOG-${runId}`,
      attributes: { size: "M" },
      initialStock: 10,
    });

    await productVariantService.adjustStock({
      variantId: variant.id,
      delta: -3,
      reason: "MANUAL_ADJUSTMENT",
      actorId,
      note: "test decrement",
    });

    const transactions = await prisma.variantInventoryTransaction.findMany({
      where: { variantId: variant.id },
    });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]!.previousQuantity).toBe(10);
    expect(transactions[0]!.adjustment).toBe(-3);
    expect(transactions[0]!.newQuantity).toBe(7);
  });

  it("CONCURRENCY: two simultaneous decrements for the last units of stock — only one succeeds, no overselling", async () => {
    const actorId = await makeActor("concurrency");
    const productId = await makeProduct("concurrency");
    const variant = await productVariantService.create({
      productId,
      sku: `SKU-CONCURRENCY-${runId}`,
      attributes: { size: "M" },
      initialStock: 10,
    });

    const attempt = () =>
      productVariantService.adjustStock({
        variantId: variant.id,
        delta: -6,
        reason: "ORDER_PLACED",
        actorId,
      });

    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reloaded = await productVariantService.listForProduct(productId);
    expect(reloaded.find((v) => v.id === variant.id)?.quantity).toBe(4);
  });

  it("delete hard-deletes a variant with no order history", async () => {
    const productId = await makeProduct("delete");
    const variant = await productVariantService.create({
      productId,
      sku: `SKU-DELETE-${runId}`,
      attributes: { size: "M" },
      initialStock: 5,
    });

    await productVariantService.delete(variant.id);

    const remaining = await productVariantService.listForProduct(productId);
    expect(remaining.find((v) => v.id === variant.id)).toBeUndefined();
  });

  it("throws VariantNotFoundError when deleting a non-existent variant", async () => {
    await expect(productVariantService.delete("does-not-exist")).rejects.toThrow(VariantNotFoundError);
  });
});
