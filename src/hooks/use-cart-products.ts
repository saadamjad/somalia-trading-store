"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types/product";
import { useCartStore } from "@/stores/cart-store";

export interface CartLineItem {
  product: Product;
  quantity: number;
}

/**
 * Resolves the cart's { productId, quantity } pairs to full product records (current
 * price/name/images from the DB) via /api/products?ids=... Product data is never
 * cached in the cart store itself — see the comment in src/stores/cart-store.ts.
 */
export function useCartProducts() {
  const items = useCartStore((s) => s.items);
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  // See product-listing.tsx for why loading is derived from a "last resolved key"
  // rather than toggled with a direct setState call in the effect body.
  const [loadedIds, setLoadedIds] = useState<string | null>(null);

  const ids = items.map((i) => i.productId).join(",");

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    fetch(`/api/products?ids=${encodeURIComponent(ids)}`)
      .then((res) => res.json())
      .then((data: { items: Product[] }) => {
        if (cancelled) return;
        setProductsById((prev) => {
          const next = { ...prev };
          for (const product of data.items) next[product.id] = product;
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setLoadedIds(ids);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  // Derived from the store's current `items` (source of truth) joined with the
  // fetched cache, so an emptied cart is reflected immediately without needing an
  // extra setState call to "reset" anything.
  const lineItems: CartLineItem[] = items
    .map((item) => {
      const product = productsById[item.productId];
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter((x): x is CartLineItem => x !== null);

  const subtotal = lineItems.reduce(
    (sum, { product, quantity }) => sum + product.price * quantity,
    0
  );

  const isLoading = ids !== "" && loadedIds !== ids;

  return { lineItems, subtotal, isLoading };
}
