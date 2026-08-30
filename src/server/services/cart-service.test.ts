import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import {
  cartService,
  VariantProductMismatchError,
  VariantNotFoundForCartError,
} from "@/server/services/cart-service";
import { productVariantService } from "@/server/services/product-variant-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];
const variantIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase7-cart-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Cart Test ${label}`,
    email: uniqueEmail(label),
    password: "PlainTextPass1",
  });
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `cart-test-${label}-${runId}`,
      name: `Cart Test Product (${label})`,
      description: "Test fixture product for cart service tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "10.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: stock } });
  return product.id;
}

describe("cartService", () => {
  afterAll(async () => {
    await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.variantInventoryTransaction.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.variantInventory.deleteMany({ where: { variantId: { in: variantIds } } });
    await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  describe("setItem", () => {
    it("adding an item creates exactly one CartItem row, adding the same product again updates quantity rather than duplicating", async () => {
      const user = await createCustomer("upsert");
      const productId = await createProduct("upsert", 50);

      await cartService.setItem(user.id, productId, 2);
      let cart = await prisma.cart.findUniqueOrThrow({
        where: { userId: user.id },
        include: { items: true },
      });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);

      // Same product added again — quantity updates, no second row.
      await cartService.setItem(user.id, productId, 5);
      cart = await prisma.cart.findUniqueOrThrow({
        where: { userId: user.id },
        include: { items: true },
      });
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(5);
    });

    it("setting quantity to 0 removes the item", async () => {
      const user = await createCustomer("remove-via-zero");
      const productId = await createProduct("remove-via-zero", 50);

      await cartService.setItem(user.id, productId, 3);
      await cartService.setItem(user.id, productId, 0);

      const items = await cartService.getCartForUser(user.id);
      expect(items).toHaveLength(0);
    });
  });

  describe("removeItem / clearCart", () => {
    it("removeItem removes only the targeted product", async () => {
      const user = await createCustomer("remove-one");
      const productA = await createProduct("remove-one-a", 50);
      const productB = await createProduct("remove-one-b", 50);

      await cartService.setItem(user.id, productA, 1);
      await cartService.setItem(user.id, productB, 1);
      await cartService.removeItem(user.id, productA);

      const items = await cartService.getCartForUser(user.id);
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe(productB);
    });

    it("clearCart empties every item", async () => {
      const user = await createCustomer("clear");
      const productId = await createProduct("clear", 50);

      await cartService.setItem(user.id, productId, 2);
      await cartService.clearCart(user.id);

      const items = await cartService.getCartForUser(user.id);
      expect(items).toHaveLength(0);
    });
  });

  describe("mergeGuestItems (guest -> logged-in cart merge)", () => {
    it("sums quantities for matching products and keeps items unique to either side", async () => {
      const user = await createCustomer("merge");
      const shared = await createProduct("merge-shared", 50);
      const serverOnly = await createProduct("merge-server-only", 50);
      const guestOnly = await createProduct("merge-guest-only", 50);

      // Server already has: shared x2, serverOnly x1.
      await cartService.setItem(user.id, shared, 2);
      await cartService.setItem(user.id, serverOnly, 1);

      // Guest cart (localStorage) has: shared x3, guestOnly x4.
      const merged = await cartService.mergeGuestItems(user.id, [
        { productId: shared, quantity: 3 },
        { productId: guestOnly, quantity: 4 },
      ]);

      const byProduct = Object.fromEntries(merged.map((i) => [i.productId, i.quantity]));
      expect(byProduct[shared]).toBe(5); // summed: 2 + 3
      expect(byProduct[serverOnly]).toBe(1); // untouched, only on server side
      expect(byProduct[guestOnly]).toBe(4); // untouched, only on guest side
      expect(merged).toHaveLength(3);
    });

    it("merging an empty guest cart returns the server cart unchanged (page-load reconcile case)", async () => {
      const user = await createCustomer("merge-empty");
      const productId = await createProduct("merge-empty", 50);
      await cartService.setItem(user.id, productId, 7);

      const merged = await cartService.mergeGuestItems(user.id, []);

      expect(merged).toHaveLength(1);
      expect(merged[0].quantity).toBe(7);
    });
  });

  describe("validateStock", () => {
    it("flags a cart item whose requested quantity exceeds current inventory", async () => {
      const inStock = await createProduct("validate-in-stock", 10);
      const overStock = await createProduct("validate-over-stock", 2);

      const issues = await cartService.validateStock([
        { productId: inStock, quantity: 5 },
        { productId: overStock, quantity: 5 },
      ]);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ productId: overStock, requested: 5, available: 2 });
    });

    it("treats a product with no Inventory row as 0 available", async () => {
      const category = await prisma.category.findFirstOrThrow();
      const product = await prisma.product.create({
        data: {
          slug: `cart-test-no-inventory-${runId}`,
          name: "No Inventory Product",
          description: "Test fixture.",
          shortDescription: "Test fixture.",
          categoryId: category.id,
          price: "1.00",
          images: ["https://example.com/test.jpg"],
        },
      });
      productIds.push(product.id);

      const issues = await cartService.validateStock([{ productId: product.id, quantity: 1 }]);
      expect(issues).toHaveLength(1);
      expect(issues[0].available).toBe(0);
    });
  });

  describe("ownership", () => {
    it("each user's cart is fully independent — operating on one user's cart never touches another's", async () => {
      const userA = await createCustomer("ownership-a");
      const userB = await createCustomer("ownership-b");
      const productId = await createProduct("ownership", 50);

      await cartService.setItem(userA.id, productId, 1);
      await cartService.setItem(userB.id, productId, 9);
      await cartService.clearCart(userA.id);

      const itemsA = await cartService.getCartForUser(userA.id);
      const itemsB = await cartService.getCartForUser(userB.id);

      expect(itemsA).toHaveLength(0);
      expect(itemsB).toHaveLength(1);
      expect(itemsB[0].quantity).toBe(9);
    });
  });

  describe("variant-aware lines", () => {
    it("two different variants of the same product coexist as two distinct cart lines", async () => {
      const user = await createCustomer("variant-coexist");
      const productId = await createProduct("variant-coexist", 50);
      const variantA = await productVariantService.create({
        productId,
        sku: `SKU-CART-A-${runId}`,
        attributes: { size: "S" },
        initialStock: 10,
      });
      const variantB = await productVariantService.create({
        productId,
        sku: `SKU-CART-B-${runId}`,
        attributes: { size: "L" },
        initialStock: 10,
      });
      variantIds.push(variantA.id, variantB.id);

      await cartService.setItem(user.id, productId, 2, variantA.id);
      await cartService.setItem(user.id, productId, 3, variantB.id);
      // Also add the plain (non-variant) line for the same product — three distinct
      // lines total, none of which should collapse into each other.
      await cartService.setItem(user.id, productId, 1);

      const items = await cartService.getCartForUser(user.id);
      expect(items).toHaveLength(3);
      expect(items.find((i) => i.variantId === variantA.id)?.quantity).toBe(2);
      expect(items.find((i) => i.variantId === variantB.id)?.quantity).toBe(3);
      expect(items.find((i) => i.variantId === null)?.quantity).toBe(1);
    });

    it("setItem for an existing variant line updates its quantity rather than duplicating", async () => {
      const user = await createCustomer("variant-upsert");
      const productId = await createProduct("variant-upsert", 50);
      const variant = await productVariantService.create({
        productId,
        sku: `SKU-CART-UPSERT-${runId}`,
        attributes: { size: "M" },
        initialStock: 10,
      });
      variantIds.push(variant.id);

      await cartService.setItem(user.id, productId, 2, variant.id);
      await cartService.setItem(user.id, productId, 7, variant.id);

      const items = await cartService.getCartForUser(user.id);
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(7);
    });

    it("removeItem with a variantId removes only that variant's line, not the plain line for the same product", async () => {
      const user = await createCustomer("variant-remove");
      const productId = await createProduct("variant-remove", 50);
      const variant = await productVariantService.create({
        productId,
        sku: `SKU-CART-REMOVE-${runId}`,
        attributes: { size: "M" },
        initialStock: 10,
      });
      variantIds.push(variant.id);

      await cartService.setItem(user.id, productId, 1);
      await cartService.setItem(user.id, productId, 1, variant.id);
      await cartService.removeItem(user.id, productId, variant.id);

      const items = await cartService.getCartForUser(user.id);
      expect(items).toHaveLength(1);
      expect(items[0].variantId).toBeNull();
    });

    it("validateStock checks a variant's own stock independently of the parent product's stock", async () => {
      const productId = await createProduct("variant-stock-check", 100);
      const variant = await productVariantService.create({
        productId,
        sku: `SKU-CART-STOCKCHECK-${runId}`,
        attributes: { size: "M" },
        initialStock: 2,
      });
      variantIds.push(variant.id);

      const issues = await cartService.validateStock([
        { productId, quantity: 5, variantId: variant.id },
      ]);
      expect(issues).toHaveLength(1);
      expect(issues[0]!.available).toBe(2);

      const okIssues = await cartService.validateStock([
        { productId, quantity: 2, variantId: variant.id },
      ]);
      expect(okIssues).toHaveLength(0);
    });

    it("SECURITY: rejects a variantId that belongs to a DIFFERENT product than the one it's paired with", async () => {
      const user = await createCustomer("variant-mismatch");
      const productA = await createProduct("variant-mismatch-a", 10);
      const productB = await createProduct("variant-mismatch-b", 10);
      const variantOfB = await productVariantService.create({
        productId: productB,
        sku: `SKU-CART-MISMATCH-${runId}`,
        attributes: { size: "M" },
        initialStock: 10,
      });
      variantIds.push(variantOfB.id);

      await expect(cartService.setItem(user.id, productA, 1, variantOfB.id)).rejects.toThrow(
        VariantProductMismatchError
      );

      // No line should have been written at all — reject, don't silently write a
      // mismatched line.
      const items = await cartService.getCartForUser(user.id);
      expect(items).toHaveLength(0);
    });

    it("SECURITY: rejects a variantId that doesn't exist at all", async () => {
      const user = await createCustomer("variant-missing");
      const productId = await createProduct("variant-missing", 10);

      await expect(cartService.setItem(user.id, productId, 1, "does-not-exist")).rejects.toThrow(
        VariantNotFoundForCartError
      );
    });
  });
});
