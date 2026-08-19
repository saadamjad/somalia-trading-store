import { create } from "zustand";
import { persist } from "zustand/middleware";

// Phase 7 note: localStorage remains the source of truth for guests, UNCHANGED. For a
// logged-in user, mutations ALSO write through to the server wishlist (/api/wishlist)
// in the background — see the matching comment in src/stores/cart-store.ts for the
// full rationale; the pattern here is identical.
let syncUserId: string | null = null;

export function setWishlistSyncUser(userId: string | null) {
  syncUserId = userId;
}

function syncAddItem(productId: string) {
  if (!syncUserId) return;
  fetch("/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  }).catch(() => {});
}

function syncRemoveItem(productId: string) {
  if (!syncUserId) return;
  fetch(`/api/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" }).catch(() => {});
}

interface WishlistStore {
  items: string[];
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  toggleItem: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
  getCount: () => number;
  clearWishlist: () => void;
  /** Replaces the store's items wholesale without triggering a server sync write —
   * used to load the merged server wishlist into the store on login / page load with
   * an existing session. */
  hydrateFromServer: (productIds: string[]) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId) => {
        set((state) => ({
          items: state.items.includes(productId)
            ? state.items
            : [...state.items, productId],
        }));
        syncAddItem(productId);
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((id) => id !== productId),
        }));
        syncRemoveItem(productId);
      },

      toggleItem: (productId) => {
        const { items, addItem, removeItem } = get();
        if (items.includes(productId)) {
          removeItem(productId);
        } else {
          addItem(productId);
        }
      },

      isInWishlist: (productId) => get().items.includes(productId),

      getCount: () => get().items.length,

      clearWishlist: () => set({ items: [] }),

      hydrateFromServer: (productIds) => set({ items: productIds }),
    }),
    { name: "somalia-trading-wishlist" }
  )
);
