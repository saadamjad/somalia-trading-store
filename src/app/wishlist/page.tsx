"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import { useWishlistStore } from "@/stores/wishlist-store";
import { productService } from "@/lib/services/product-service";

export default function WishlistPage() {
  const items = useWishlistStore((s) => s.items);
  const products = items
    .map((id) => productService.getById(id))
    .filter(Boolean);

  if (products.length === 0) {
    return (
      <div className="container-custom flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <Heart className="mb-6 h-20 w-20 text-muted" />
        <h1 className="font-display mb-2 text-3xl font-bold">
          Your Wishlist is Empty
        </h1>
        <p className="mb-8 max-w-md text-muted">
          Save products you love by clicking the heart icon on any product
          card.
        </p>
        <Button asChild size="lg">
          <Link href="/shop">Browse Products</Link>
        </Button>
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
          <ProductCard key={product!.id} product={product!} />
        ))}
      </div>
    </div>
  );
}
