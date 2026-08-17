import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types/product";
import { productService } from "@/lib/services/product-service";

interface CartStore {
  items: CartItem[];
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getItemsWithProducts: () => Array<{
    product: NonNullable<ReturnType<typeof productService.getById>>;
    quantity: number;
  }>;
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

      getSubtotal: () =>
        get()
          .getItemsWithProducts()
          .reduce((sum, { product, quantity }) => sum + product.price * quantity, 0),

      getItemsWithProducts: () =>
        get()
          .items.map((item) => {
            const product = productService.getById(item.productId);
            return product ? { product, quantity: item.quantity } : null;
          })
          .filter(Boolean) as Array<{
          product: NonNullable<ReturnType<typeof productService.getById>>;
          quantity: number;
        }>,
    }),
    { name: "somalia-trading-cart" }
  )
);
