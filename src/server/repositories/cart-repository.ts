import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

/**
 * Data access only — Prisma queries, no business rules, no ownership checks beyond
 * scoping every query by the `userId`/`cartId` the caller supplies. Business-level
 * invariants (merge conflict resolution, quantity math) live in cart-service.ts.
 */
export const cartRepository = {
  findByUserId(userId: string) {
    return prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });
  },

  create(userId: string) {
    return prisma.cart.create({
      data: { userId },
      include: { items: true },
    });
  },

  /** Upserts a single item to an absolute `quantity` (never a relative delta). */
  upsertItem(cartId: string, productId: string, quantity: number) {
    return prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity },
      update: { quantity },
    });
  },

  removeItem(cartId: string, productId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId, productId } });
  },

  clearItems(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
  },

  findItem(cartId: string, productId: string) {
    return prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });
  },

  /**
   * Same lookup as `findByUserId`, but runs on a caller-supplied transaction client —
   * used by order-service.createOrder, which must clear the cart atomically alongside
   * order creation and the inventory decrement (see the note on
   * inventory-service.adjustStock about why `prisma.$transaction` calls don't nest).
   */
  findByUserIdTx(tx: Prisma.TransactionClient, userId: string) {
    return tx.cart.findUnique({ where: { userId }, include: { items: true } });
  },

  clearItemsTx(tx: Prisma.TransactionClient, cartId: string) {
    return tx.cartItem.deleteMany({ where: { cartId } });
  },
};
