import { cartRepository } from "@/server/repositories/cart-repository";
import { inventoryService } from "@/server/services/inventory-service";
import type { CartItemInput } from "@/lib/validations/cart";

export interface CartItemView {
  productId: string;
  quantity: number;
}

export interface StockIssue {
  productId: string;
  requested: number;
  available: number;
}

function toView(items: { productId: string; quantity: number }[]): CartItemView[] {
  return items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
}

/**
 * Server-side persistence for a logged-in user's cart. Every method takes `userId`
 * from the caller's server-verified session (never a client-supplied value) — same
 * ownership pattern as address-service.ts. There is no "cart id" in any public method
 * signature: every operation is implicitly scoped to "the caller's own cart", so
 * there's no id a client could pass to target someone else's cart (see the Phase 7
 * ownership test, cart-service.test.ts, which confirms this explicitly).
 */
export const cartService = {
  /** Creates an empty server cart on first use — carts are not created at registration. */
  async getOrCreateForUser(userId: string) {
    const existing = await cartRepository.findByUserId(userId);
    if (existing) return existing;
    try {
      return await cartRepository.create(userId);
    } catch (error) {
      // Race: two concurrent calls both saw "no cart yet" and both tried to create
      // one — Cart.userId is unique, so the second create() loses. Fall back to
      // reading the row the first call just created (same pattern as
      // wishlist-service.ts).
      if (isUniqueConstraintError(error)) {
        const cart = await cartRepository.findByUserId(userId);
        if (cart) return cart;
      }
      throw error;
    }
  },

  async getCartForUser(userId: string): Promise<CartItemView[]> {
    const cart = await this.getOrCreateForUser(userId);
    return toView(cart.items);
  },

  /**
   * Upserts a single item to an absolute quantity (the client store is the source of
   * truth for "what the final quantity should be" — see cart-store.ts — so this mirrors
   * that rather than accepting a relative delta).
   */
  async setItem(userId: string, productId: string, quantity: number): Promise<CartItemView[]> {
    const cart = await this.getOrCreateForUser(userId);
    if (quantity <= 0) {
      await cartRepository.removeItem(cart.id, productId);
    } else {
      await cartRepository.upsertItem(cart.id, productId, quantity);
    }
    return this.getCartForUser(userId);
  },

  async removeItem(userId: string, productId: string): Promise<CartItemView[]> {
    const cart = await this.getOrCreateForUser(userId);
    await cartRepository.removeItem(cart.id, productId);
    return this.getCartForUser(userId);
  },

  async clearCart(userId: string): Promise<void> {
    const cart = await this.getOrCreateForUser(userId);
    await cartRepository.clearItems(cart.id);
  },

  /**
   * Guest-to-server merge (Phase 7 point 2). Conflict resolution: when a product exists
   * on both sides, quantities are SUMMED (a reasonable default — the guest explicitly
   * chose to add those units on this device, and the server cart may hold units chosen
   * on another device/session; summing loses neither). Products present on only one
   * side are carried through unchanged. This is idempotent enough to double as "load
   * server cart into the store" — merging an empty guest list simply returns the
   * server cart unchanged (see docs/IMPLEMENTATION_PLAN.md Phase 7 point 5).
   */
  async mergeGuestItems(userId: string, guestItems: CartItemInput[]): Promise<CartItemView[]> {
    const cart = await this.getOrCreateForUser(userId);
    const existingByProduct = new Map<string, number>(
      cart.items.map((i) => [i.productId, i.quantity])
    );

    for (const guestItem of guestItems) {
      const current = existingByProduct.get(guestItem.productId) ?? 0;
      const merged = current + guestItem.quantity;
      await cartRepository.upsertItem(cart.id, guestItem.productId, merged);
    }

    return this.getCartForUser(userId);
  },

  /**
   * Stock validation before checkout (Phase 7 point 4 — checkout itself is Phase 8).
   * Public-safe: uses inventoryService.getAvailableQuantities, which doesn't require
   * the admin `inventory.view` permission. Returns one entry per item whose requested
   * quantity exceeds current stock; an empty array means every item is purchasable at
   * its requested quantity right now. A product with no Inventory row at all is treated
   * as 0 available (out of stock), not skipped.
   */
  async validateStock(items: CartItemInput[]): Promise<StockIssue[]> {
    if (items.length === 0) return [];

    const productIds = items.map((i) => i.productId);
    const available = await inventoryService.getAvailableQuantities(productIds);

    const issues: StockIssue[] = [];
    for (const item of items) {
      const availableQty = available.get(item.productId) ?? 0;
      if (item.quantity > availableQty) {
        issues.push({ productId: item.productId, requested: item.quantity, available: availableQty });
      }
    }
    return issues;
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
