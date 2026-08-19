import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types/product";

// Phase 4 note: this store only ever holds { productId, quantity } — never a
// product's price/name. Product data now lives in Postgres and is server/API-only, so
// resolving cart items to full product records (price, name, images, current stock)
// happens client-side via useCartProducts() (src/hooks/use-cart-products.ts), which
// fetches /api/products?ids=... Price is always read live from the DB response, never
// cached in this store — see docs/IMPLEMENTATION_PLAN.md Phase 4 data-integrity note.
interface CartStore {
  items: CartItem[];
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.productId === productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === productId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, { productId, quantity }] };
        });
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        }));
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      getItemCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "somalia-trading-cart" }
  )
);
