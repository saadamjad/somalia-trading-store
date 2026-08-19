import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import {
  inventoryService,
  InsufficientStockError,
  InventoryNotFoundError,
} from "@/server/services/inventory-service";

// Unique suffix per test run so parallel/repeat runs never collide with each other or
// with seeded data — matches the existing test style (see auth-service.test.ts).
const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const productIds: string[] = [];
const userIds: string[] = [];

async function makeActor(label: string) {
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
  const user = await prisma.user.create({
    data: {
      email: `inventory-${label}-${runId}@example.test`,
      passwordHash: "not-a-real-hash",
      name: `Inventory Test Actor (${label})`,
      roleId: customerRole.id,
    },
  });
  userIds.push(user.id);
  return user.id;
}

async function makeProductWithStock(label: string, quantity: number, lowStockThreshold = 10) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `inventory-test-${label}-${runId}`,
      name: `Inventory Test Product (${label})`,
      description: "Test fixture product for inventory service tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "1.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);

  await prisma.inventory.create({
    data: { productId: product.id, quantity, lowStockThreshold },
  });

  return product.id;
}

describe("inventoryService.adjustStock", () => {
  afterAll(async () => {
    await prisma.inventoryTransaction.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("rejects an adjustment that would push quantity negative, and makes no change", async () => {
    const actorId = await makeActor("reject-negative");
    const productId = await makeProductWithStock("reject-negative", 5);

    await expect(
      inventoryService.adjustStock({
        productId,
        delta: -10,
        reason: "MANUAL_ADJUSTMENT",
        actorId,
      })
    ).rejects.toThrow(InsufficientStockError);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(inventory.quantity).toBe(5);

    const transactions = await prisma.inventoryTransaction.count({ where: { productId } });
    expect(transactions).toBe(0);
  });

  it("throws InventoryNotFoundError for a product with no inventory row", async () => {
    const actorId = await makeActor("no-inventory");
    const category = await prisma.category.findFirstOrThrow();
    const product = await prisma.product.create({
      data: {
        slug: `inventory-test-no-inv-${runId}`,
        name: "No Inventory Product",
        description: "Test fixture.",
        shortDescription: "Test fixture.",
        categoryId: category.id,
        price: "1.00",
        images: ["https://example.com/test.jpg"],
      },
    });
    productIds.push(product.id);

    await expect(
      inventoryService.adjustStock({
        productId: product.id,
        delta: 5,
        reason: "RESTOCK",
        actorId,
      })
    ).rejects.toThrow(InventoryNotFoundError);
  });

  it("produces exactly one InventoryTransaction row with correct previous/new quantity and actor, and updates Inventory atomically", async () => {
    const actorId = await makeActor("single-transaction");
    const productId = await makeProductWithStock("single-transaction", 20);

    const result = await inventoryService.adjustStock({
      productId,
      delta: 15,
      reason: "RESTOCK",
      actorId,
      note: "Received new shipment",
    });

    expect(result.inventory.quantity).toBe(35);
    expect(result.transaction.previousQuantity).toBe(20);
    expect(result.transaction.adjustment).toBe(15);
    expect(result.transaction.newQuantity).toBe(35);
    expect(result.transaction.actorId).toBe(actorId);
    expect(result.transaction.reason).toBe("RESTOCK");
    expect(result.transaction.note).toBe("Received new shipment");

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(inventory.quantity).toBe(35);

    const transactions = await prisma.inventoryTransaction.findMany({ where: { productId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].previousQuantity).toBe(20);
    expect(transactions[0].newQuantity).toBe(35);
    expect(transactions[0].actorId).toBe(actorId);
  });

  it("supports negative deltas that stay at or above zero", async () => {
    const actorId = await makeActor("decrement");
    const productId = await makeProductWithStock("decrement", 10);

    const result = await inventoryService.adjustStock({
      productId,
      delta: -10,
      reason: "ORDER_PLACED",
      actorId,
    });

    expect(result.inventory.quantity).toBe(0);
    expect(result.transaction.newQuantity).toBe(0);
  });

  // The single most important test in this phase: two concurrent adjustments that
  // together would oversell must not both succeed. Two requests each try to decrement
  // by the full quantity-on-hand (10) at the same time — only one can succeed; the
  // other must fail cleanly (InsufficientStockError), and the final stock must never go
  // negative. This proves the atomic conditional UPDATE in inventory-repository.ts
  // (`WHERE quantity + delta >= 0`) actually serializes concurrent writers correctly,
  // rather than relying on an application-level read-then-write that would race.
  it("prevents race-condition overselling: only one of two concurrent full-decrement attempts succeeds", async () => {
    const actorId = await makeActor("concurrency");
    const productId = await makeProductWithStock("concurrency", 10);

    const attempt = () =>
      inventoryService.adjustStock({
        productId,
        delta: -10,
        reason: "ORDER_PLACED",
        actorId,
      });

    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      InsufficientStockError
    );

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(inventory.quantity).toBe(0);
    expect(inventory.quantity).toBeGreaterThanOrEqual(0);

    const transactions = await prisma.inventoryTransaction.findMany({ where: { productId } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].newQuantity).toBe(0);
  });
});
