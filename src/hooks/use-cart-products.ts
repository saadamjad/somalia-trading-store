"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types/product";
import { useCartStore } from "@/stores/cart-store";

export interface CartVariant {
  id: string;
  productId: string;
  sku: string;
  label: string;
  price: number | null;
  image: string | null;
  quantity: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

export interface CartLineItem {
  product: Product;
  quantity: number;
  variant: CartVariant | null;
  /** The line's actual unit price — the variant's price override when present,
   * otherwise the product's own price. Always use this for cart/checkout totals,
   * never `product.price` directly, once variants exist. */
  unitPrice: number;
}

/**
 * Resolves the cart's { productId, quantity, variantId? } lines to full product (and,
 * for variant lines, variant) records via /api/products?ids=... and
 * /api/product-variants?ids=.... Neither product nor variant data is ever cached in
 * the cart store itself — see the comment in src/stores/cart-store.ts.
 */
export function useCartProducts() {
  const items = useCartStore((s) => s.items);
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [variantsById, setVariantsById] = useState<Record<string, CartVariant>>({});
  // See product-listing.tsx for why loading is derived from a "last resolved key"
  // rather than toggled with a direct setState call in the effect body.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const productIds = [...new Set(items.map((i) => i.productId))].join(",");
  const variantIds = [...new Set(items.map((i) => i.variantId).filter((v): v is string => Boolean(v)))].join(",");
  const key = `${productIds}|${variantIds}`;

  useEffect(() => {
    if (!productIds && !variantIds) return;
    let cancelled = false;

    Promise.all([
      productIds
        ? fetch(`/api/products?ids=${encodeURIComponent(productIds)}`).then((res) => res.json())
        : Promise.resolve({ items: [] as Product[] }),
      variantIds
        ? fetch(`/api/product-variants?ids=${encodeURIComponent(variantIds)}`).then((res) => res.json())
        : Promise.resolve({ items: [] as CartVariant[] }),
    ])
      .then(([productData, variantData]: [{ items: Product[] }, { items: CartVariant[] }]) => {
        if (cancelled) return;
        setProductsById((prev) => {
          const next = { ...prev };
          for (const product of productData.items) next[product.id] = product;
          return next;
        });
        setVariantsById((prev) => {
          const next = { ...prev };
          for (const variant of variantData.items) next[variant.id] = variant;
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key, productIds, variantIds]);

  // Derived from the store's current `items` (source of truth) joined with the
  // fetched cache, so an emptied cart is reflected immediately without needing an
  // extra setState call to "reset" anything.
  const lineItems: CartLineItem[] = items
    .map((item) => {
      const product = productsById[item.productId];
      if (!product) return null;
      const variant = item.variantId ? (variantsById[item.variantId] ?? null) : null;
      if (item.variantId && !variant) return null; // variant not yet resolved
      const unitPrice = variant?.price ?? product.price;
      return { product, quantity: item.quantity, variant, unitPrice };
    })
    .filter((x): x is CartLineItem => x !== null);

  const subtotal = lineItems.reduce(
    (sum, { unitPrice, quantity }) => sum + unitPrice * quantity,
    0
  );

  const isLoading = key !== "|" && loadedKey !== key;

  return { lineItems, subtotal, isLoading };
}
