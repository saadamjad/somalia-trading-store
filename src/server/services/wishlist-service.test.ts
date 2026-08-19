import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { wishlistService } from "@/server/services/wishlist-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase7-wishlist-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Wishlist Test ${label}`,
    email: uniqueEmail(label),
    password: "PlainTextPass1",
  });
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `wishlist-test-${label}-${runId}`,
      name: `Wishlist Test Product (${label})`,
      description: "Test fixture product for wishlist service tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "10.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  return product.id;
}

describe("wishlistService", () => {
  afterAll(async () => {
    await prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.wishlist.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  describe("addItem duplicate-prevention", () => {
    it("adding the same product twice results in exactly one WishlistItem row", async () => {
      const user = await createCustomer("dup-sequential");
      const productId = await createProduct("dup-sequential");

      await wishlistService.addItem(user.id, productId);
      await wishlistService.addItem(user.id, productId);

      const wishlist = await prisma.wishlist.findUniqueOrThrow({
        where: { userId: user.id },
        include: { items: true },
      });
      expect(wishlist.items).toHaveLength(1);
    });

    it("is enforced server-side even under concurrent duplicate POSTs (DB unique constraint, not just client dedup)", async () => {
      const user = await createCustomer("dup-concurrent");
      const productId = await createProduct("dup-concurrent");

      // Simulates a client sending the same POST twice back-to-back before the first
      // has resolved — the race the DB unique constraint (not application logic) must
      // resolve safely.
      await Promise.all([
        wishlistService.addItem(user.id, productId),
        wishlistService.addItem(user.id, productId),
      ]);

      const wishlist = await prisma.wishlist.findUniqueOrThrow({
        where: { userId: user.id },
        include: { items: true },
      });
      expect(wishlist.items).toHaveLength(1);
    });
  });

  describe("removeItem", () => {
    it("removes only the targeted product", async () => {
      const user = await createCustomer("remove");
      const productA = await createProduct("remove-a");
      const productB = await createProduct("remove-b");

      await wishlistService.addItem(user.id, productA);
      await wishlistService.addItem(user.id, productB);
      await wishlistService.removeItem(user.id, productA);

      const items = await wishlistService.getWishlistForUser(user.id);
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe(productB);
    });
  });

  describe("ownership", () => {
    it("each user's wishlist is fully independent", async () => {
      const userA = await createCustomer("ownership-a");
      const userB = await createCustomer("ownership-b");
      const productId = await createProduct("ownership");

      await wishlistService.addItem(userA.id, productId);

      const itemsA = await wishlistService.getWishlistForUser(userA.id);
      const itemsB = await wishlistService.getWishlistForUser(userB.id);

      expect(itemsA).toHaveLength(1);
      expect(itemsB).toHaveLength(0);
    });
  });
});
