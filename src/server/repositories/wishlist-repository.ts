import { prisma } from "@/server/lib/prisma";

/**
 * Data access only — Prisma queries, no business rules. Duplicate-prevention is a DB
 * constraint (`@@unique([wishlistId, productId])` on WishlistItem), not application
 * logic here — see wishlist-service.ts for how `addItem` relies on it.
 */
export const wishlistRepository = {
  findByUserId(userId: string) {
    return prisma.wishlist.findUnique({
      where: { userId },
      include: { items: true },
    });
  },

  create(userId: string) {
    return prisma.wishlist.create({
      data: { userId },
      include: { items: true },
    });
  },

  addItem(wishlistId: string, productId: string) {
    return prisma.wishlistItem.create({ data: { wishlistId, productId } });
  },

  removeItem(wishlistId: string, productId: string) {
    return prisma.wishlistItem.deleteMany({ where: { wishlistId, productId } });
  },

  findItem(wishlistId: string, productId: string) {
    return prisma.wishlistItem.findUnique({
      where: { wishlistId_productId: { wishlistId, productId } },
    });
  },
};
