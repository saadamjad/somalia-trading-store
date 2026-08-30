import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/lib/prisma";

/**
 * Data access only — Prisma queries, no business rules, no ownership checks beyond
 * scoping every query by the `userId`/`cartId` the caller supplies. Business-level
 * invariants (merge conflict resolution, quantity math) live in cart-service.ts.
 *
 * `variantId` is always an explicit `string | null` (never `undefined`) throughout
 * this file — `null` means "the plain, non-variant product line". There is no
 * Prisma-generated compound-unique `where` shortcut for (cartId, productId, variantId)
 * here (unlike the pre-variants version of this file) because the DB-level dedup
 * constraint is now a pair of hand-added PARTIAL unique indexes (one for
 * `variantId IS NULL`, one for `variantId IS NOT NULL` — see the
 * add_product_variants migration and CartItem's schema comment), which Prisma's
 * schema DSL has no way to express as a named `@@unique` the client can target
 * directly. So every method here does an explicit `findFirst` + create/update instead
 * of `upsert`, with the same P2002-catch-and-recover race handling used elsewhere in
 * this codebase (see cart-service.ts `getOrCreateForUser` and
 * wishlist-service.ts `addItem`) to stay safe under concurrent requests.
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

  findItem(cartId: string, productId: string, variantId: string | null) {
    return prisma.cartItem.findFirst({
      where: { cartId, productId, variantId },
    });
  },

  /** Upserts a single item to an absolute `quantity` (never a relative delta). */
  async upsertItem(cartId: string, productId: string, variantId: string | null, quantity: number) {
    const existing = await prisma.cartItem.findFirst({ where: { cartId, productId, variantId } });
    if (existing) {
      return prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
    }
    try {
      return await prisma.cartItem.create({ data: { cartId, productId, variantId, quantity } });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // Race: another concurrent call created this exact line first. Fall back to
        // updating the row that just won, rather than surfacing a spurious failure.
        const winner = await prisma.cartItem.findFirstOrThrow({ where: { cartId, productId, variantId } });
        return prisma.cartItem.update({ where: { id: winner.id }, data: { quantity } });
      }
      throw error;
    }
  },

  removeItem(cartId: string, productId: string, variantId: string | null) {
    return prisma.cartItem.deleteMany({ where: { cartId, productId, variantId } });
  },

  clearItems(cartId: string) {
    return prisma.cartItem.deleteMany({ where: { cartId } });
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

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
