"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductCard } from "@/components/product/product-card";
import { useWishlistStore } from "@/stores/wishlist-store";
import type { Product } from "@/lib/types/product";

export default function WishlistPage() {
  const items = useWishlistStore((s) => s.items);
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const ids = items.join(",");

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
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  // Derived from the store's current wishlist ids (source of truth) joined with the
  // fetched cache — an emptied wishlist is reflected immediately with no extra
  // setState "reset" needed.
  const products = items
    .map((id) => productsById[id])
    .filter((p): p is Product => Boolean(p));

  if (products.length === 0) {
    return (
      <div className="container-custom min-h-[60vh] py-24">
        <EmptyState
          icon={Heart}
          title="Your Wishlist is Empty"
          description="Save products you love by clicking the heart icon on any product card."
          action={
            <Button asChild size="lg">
              <Link href="/shop">Browse Products</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-custom py-24 md:py-28">
      <h1 className="font-display mb-2 text-3xl font-bold md:text-4xl">
        Wishlist
      </h1>
      <p className="mb-8 text-muted">{products.length} saved products</p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
