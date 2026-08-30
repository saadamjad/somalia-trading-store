import { cartRepository } from "@/server/repositories/cart-repository";
import { inventoryService } from "@/server/services/inventory-service";
import { productVariantRepository } from "@/server/repositories/product-variant-repository";
import type { CartItemInput } from "@/lib/validations/cart";

export class VariantNotFoundForCartError extends Error {
  constructor() {
    super("Selected variant not found.");
    this.name = "VariantNotFoundForCartError";
  }
}

/** Thrown when a `(productId, variantId)` pair doesn't actually match — e.g. a
 * variant that belongs to a different product. Never trust the client's pairing:
 * without this check, a buggy or malicious client could add a cart line whose
 * variant snapshot (SKU, label, price) belongs to an entirely different product than
 * the one the order line is recorded against. */
export class VariantProductMismatchError extends Error {
  constructor() {
    super("Selected variant does not belong to this product.");
    this.name = "VariantProductMismatchError";
  }
}

async function assertVariantBelongsToProduct(productId: string, variantId: string): Promise<void> {
  const variant = await productVariantRepository.findById(variantId);
  if (!variant) throw new VariantNotFoundForCartError();
  if (variant.productId !== productId) throw new VariantProductMismatchError();
}

/** Structurally compatible with both `CartItemInput` (request bodies, `variantId?:
 * string`) and `CartItemView` (server cart reads, `variantId: string | null`) — lets
 * `validateStock` accept either without a lossy conversion at every call site. */
interface StockCheckItem {
  productId: string;
  quantity: number;
  variantId?: string | null;
}

export interface CartItemView {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface StockIssue {
  productId: string;
  variantId: string | null;
  requested: number;
  available: number;
}

function toView(
  items: { productId: string; variantId: string | null; quantity: number }[]
): CartItemView[] {
  return items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity }));
}

/** A cart line is uniquely identified by (productId, variantId) — two different
 * variants of the same product are two distinct lines. Used to key the merge map in
 * `mergeGuestItems` and anywhere else a cart needs to be grouped by line identity. */
function lineKey(productId: string, variantId: string | null): string {
  return `${productId}::${variantId ?? ""}`;
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
   * that rather than accepting a relative delta). `variantId: null` (the default) is a
   * plain, non-variant product line.
   */
  async setItem(
    userId: string,
    productId: string,
    quantity: number,
    variantId: string | null = null
  ): Promise<CartItemView[]> {
    if (variantId) {
      await assertVariantBelongsToProduct(productId, variantId);
    }
    const cart = await this.getOrCreateForUser(userId);
    if (quantity <= 0) {
      await cartRepository.removeItem(cart.id, productId, variantId);
    } else {
      await cartRepository.upsertItem(cart.id, productId, variantId, quantity);
    }
    return this.getCartForUser(userId);
  },

  async removeItem(
    userId: string,
    productId: string,
    variantId: string | null = null
  ): Promise<CartItemView[]> {
    const cart = await this.getOrCreateForUser(userId);
    await cartRepository.removeItem(cart.id, productId, variantId);
    return this.getCartForUser(userId);
  },

  async clearCart(userId: string): Promise<void> {
    const cart = await this.getOrCreateForUser(userId);
    await cartRepository.clearItems(cart.id);
  },

  /**
   * Guest-to-server merge (Phase 7 point 2). Conflict resolution: when a (product,
   * variant) line exists on both sides, quantities are SUMMED (a reasonable default —
   * the guest explicitly chose to add those units on this device, and the server cart
   * may hold units chosen on another device/session; summing loses neither). Lines
   * present on only one side are carried through unchanged. This is idempotent enough
   * to double as "load server cart into the store" — merging an empty guest list
   * simply returns the server cart unchanged (see docs/IMPLEMENTATION_PLAN.md Phase 7
   * point 5).
   */
  async mergeGuestItems(userId: string, guestItems: CartItemInput[]): Promise<CartItemView[]> {
    const cart = await this.getOrCreateForUser(userId);
    const existingByLine = new Map<string, number>(
      cart.items.map((i) => [lineKey(i.productId, i.variantId), i.quantity])
    );

    for (const guestItem of guestItems) {
      const variantId = guestItem.variantId ?? null;
      if (variantId) {
        // A stale localStorage entry (e.g. the variant was deleted, or reassigned to
        // a different product, since it was added) shouldn't abort merging the rest
        // of an otherwise-valid guest cart — skip just this one line.
        try {
          await assertVariantBelongsToProduct(guestItem.productId, variantId);
        } catch (error) {
          if (error instanceof VariantNotFoundForCartError || error instanceof VariantProductMismatchError) {
            continue;
          }
          throw error;
        }
      }
      const current = existingByLine.get(lineKey(guestItem.productId, variantId)) ?? 0;
      const merged = current + guestItem.quantity;
      await cartRepository.upsertItem(cart.id, guestItem.productId, variantId, merged);
    }

    return this.getCartForUser(userId);
  },

  /**
   * Stock validation before checkout (Phase 7 point 4 — checkout itself is Phase 8).
   * Public-safe: uses inventoryService.getAvailableQuantities, which doesn't require
   * the admin `inventory.view` permission. Returns one entry per item whose requested
   * quantity exceeds current stock; an empty array means every item is purchasable at
   * its requested quantity right now. A product/variant with no Inventory row at all
   * is treated as 0 available (out of stock), not skipped.
   */
  async validateStock(items: StockCheckItem[]): Promise<StockIssue[]> {
    if (items.length === 0) return [];

    const productIds = items.filter((i) => !i.variantId).map((i) => i.productId);
    const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);

    const [availableByProduct, availableByVariant] = await Promise.all([
      productIds.length > 0 ? inventoryService.getAvailableQuantities(productIds) : new Map(),
      variantIds.length > 0 ? inventoryService.getAvailableVariantQuantities(variantIds) : new Map(),
    ]);

    const issues: StockIssue[] = [];
    for (const item of items) {
      const variantId = item.variantId ?? null;
      const availableQty = variantId
        ? (availableByVariant.get(variantId) ?? 0)
        : (availableByProduct.get(item.productId) ?? 0);
      if (item.quantity > availableQty) {
        issues.push({
          productId: item.productId,
          variantId,
          requested: item.quantity,
          available: availableQty,
        });
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
