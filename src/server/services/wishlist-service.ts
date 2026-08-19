import { wishlistRepository } from "@/server/repositories/wishlist-repository";

export interface WishlistItemView {
  productId: string;
}

function toView(items: { productId: string }[]): WishlistItemView[] {
  return items.map((i) => ({ productId: i.productId }));
}

/**
 * Server-side persistence for a logged-in user's wishlist. Every method takes `userId`
 * from the caller's server-verified session — same pattern as cart-service.ts. No
 * "wishlist id" appears in any public method signature, so there's no id a client could
 * pass to target someone else's wishlist.
 */
export const wishlistService = {
  async getOrCreateForUser(userId: string) {
    const existing = await wishlistRepository.findByUserId(userId);
    if (existing) return existing;
    try {
      return await wishlistRepository.create(userId);
    } catch (error) {
      // Race: two concurrent calls both saw "no wishlist yet" and both tried to
      // create one — Wishlist.userId is unique, so the second create() loses. That's
      // fine: fall back to reading the row the first call just created.
      if (isUniqueConstraintError(error)) {
        const wishlist = await wishlistRepository.findByUserId(userId);
        if (wishlist) return wishlist;
      }
      throw error;
    }
  },

  async getWishlistForUser(userId: string): Promise<WishlistItemView[]> {
    const wishlist = await this.getOrCreateForUser(userId);
    return toView(wishlist.items);
  },

  /**
   * Adds a product to the caller's wishlist. Duplicate-prevention is authoritative at
   * the DB layer (`@@unique([wishlistId, productId])` on WishlistItem) — this method is
   * idempotent by checking first and treating an already-present item as a no-op success
   * rather than an error, so a client that (accidentally or maliciously) sends the same
   * POST twice never ends up with two rows and never sees a spurious failure either.
   */
  async addItem(userId: string, productId: string): Promise<WishlistItemView[]> {
    const wishlist = await this.getOrCreateForUser(userId);
    const existing = await wishlistRepository.findItem(wishlist.id, productId);
    if (!existing) {
      try {
        await wishlistRepository.addItem(wishlist.id, productId);
      } catch (error) {
        // Race: two concurrent POSTs for the same product both pass the check above.
        // The unique constraint rejects the second insert (P2002) — that's success too,
        // the item is on the wishlist either way. Anything else re-throws.
        if (!isUniqueConstraintError(error)) throw error;
      }
    }
    return this.getWishlistForUser(userId);
  },

  async removeItem(userId: string, productId: string): Promise<WishlistItemView[]> {
    const wishlist = await this.getOrCreateForUser(userId);
    await wishlistRepository.removeItem(wishlist.id, productId);
    return this.getWishlistForUser(userId);
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
