import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types/product";

// Phase 4 note: this store only ever holds { productId, quantity, variantId? } —
// never a product's price/name. Product data now lives in Postgres and is
// server/API-only, so resolving cart items to full product records (price, name,
// images, current stock) happens client-side via useCartProducts()
// (src/hooks/use-cart-products.ts), which fetches /api/products?ids=... and, for
// variant lines, /api/product-variants?ids=.... Price is always read live from the DB
// response, never cached in this store — see docs/IMPLEMENTATION_PLAN.md Phase 4
// data-integrity note.
//
// Phase 7 note: localStorage remains the source of truth for guests, UNCHANGED — that
// is the hard requirement (docs/IMPLEMENTATION_PLAN.md Phase 7). For a logged-in user,
// mutations ALSO write through to the server cart (/api/cart) in the background, fire-
// and-forget, so a slow/failed network call never blocks or reverts the local UI. Which
// user (if any) is currently logged in is set by `setCartSyncUser` — see
// src/components/cart/account-sync.tsx, which calls it from `useSession()`. The store
// itself has no knowledge of auth/session machinery, only "is there a userId to sync
// to right now."
let syncUserId: string | null = null;

export function setCartSyncUser(userId: string | null) {
  syncUserId = userId;
}

function syncSetItem(productId: string, quantity: number, variantId?: string) {
  if (!syncUserId) return;
  fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, quantity, ...(variantId ? { variantId } : {}) }),
  }).catch(() => {
    // Best-effort background sync — a failure here doesn't affect the local cart UI.
    // The next mutation (or the next page-load reconcile) will retry implicitly.
  });
}

function syncRemoveItem(productId: string, variantId?: string) {
  if (!syncUserId) return;
  const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : "";
  fetch(`/api/cart/${encodeURIComponent(productId)}${query}`, { method: "DELETE" }).catch(() => {});
}

function syncClearCart() {
  if (!syncUserId) return;
  fetch("/api/cart", { method: "DELETE" }).catch(() => {});
}

/** A cart line is uniquely identified by (productId, variantId) — mirrors
 * cart-service.ts's server-side `lineKey`. */
function matchesLine(item: CartItem, productId: string, variantId?: string) {
  return item.productId === productId && (item.variantId ?? undefined) === variantId;
}

interface CartStore {
  items: CartItem[];
  addItem: (productId: string, quantity?: number, variantId?: string) => void;
  removeItem: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  getItemCount: () => number;
  /** Replaces the store's items wholesale without triggering a server sync write —
   * used to load the merged/reconciled server cart into the store on login / page load
   * with an existing session. See account-sync.tsx. */
  hydrateFromServer: (items: CartItem[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId, quantity = 1, variantId) => {
        set((state) => {
          const existing = state.items.find((i) => matchesLine(i, productId, variantId));
          if (existing) {
            return {
              items: state.items.map((i) =>
                matchesLine(i, productId, variantId)
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, { productId, quantity, variantId }] };
        });
        const finalQuantity =
          get().items.find((i) => matchesLine(i, productId, variantId))?.quantity ?? quantity;
        syncSetItem(productId, finalQuantity, variantId);
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter((i) => !matchesLine(i, productId, variantId)),
        }));
        syncRemoveItem(productId, variantId);
      },

      updateQuantity: (productId, quantity, variantId) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            matchesLine(i, productId, variantId) ? { ...i, quantity } : i
          ),
        }));
        syncSetItem(productId, quantity, variantId);
      },

      clearCart: () => {
        set({ items: [] });
        syncClearCart();
      },

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      hydrateFromServer: (items) => set({ items }),
    }),
    { name: "somalia-trading-cart" }
  )
);
