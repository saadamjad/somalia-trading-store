"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Minus, Plus, ShoppingCart, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/lib/types/product";
import { availabilityLabels } from "@/lib/types/product";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useUIStore } from "@/stores/ui-store";
import {
  calculateDiscount,
  cn,
  formatPrice,
  formatProductPrice,
} from "@/lib/utils";

interface ProductDetailClientProps {
  product: Product;
  related: Product[];
  categoryName: string;
}

export function ProductDetailClient({
  product,
  related,
  categoryName,
}: ProductDetailClientProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCart);
  const { isInWishlist, toggleItem } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);
  const discount = calculateDiscount(product.price, product.compareAtPrice);

  const handleAddToCart = () => {
    addItem(product.id, quantity);
    openCart();
    toast.success(`${product.name} added to cart`);
  };

  const availabilityVariant =
    product.availability === "in_stock"
      ? "success"
      : product.availability === "limited"
        ? "default"
        : "outline";

  return (
    <div className="container-custom py-24 pt-28 md:py-28 md:pt-32">
      <nav className="mb-8 text-sm text-muted" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-accent">
              Home
            </Link>
          </li>
          <li>/</li>
          <li>
            <Link
              href={`/shop/${product.category}`}
              className="hover:text-accent"
            >
              {categoryName}
            </Link>
          </li>
          <li>/</li>
          <li className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <div className="relative mb-4 aspect-square overflow-hidden bg-muted/10">
            <motion.div
              key={selectedImage}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative h-full w-full"
            >
              <Image
                src={product.images[selectedImage]}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </motion.div>
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-3">
              {product.images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "relative h-20 w-20 overflow-hidden rounded-lg border-2 transition-colors",
                    selectedImage === i
                      ? "border-accent"
                      : "border-transparent"
                  )}
                  aria-label={`View image ${i + 1}`}
                >
                  <Image
                    src={img}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
        <span className="label mb-2">{product.subcategory}</span>
          <h1 className="font-display mb-4 text-3xl font-bold md:text-4xl">
            {product.name}
          </h1>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Badge variant={availabilityVariant}>
              {availabilityLabels[product.availability]}
            </Badge>
            {product.sku && (
              <span className="text-sm text-muted">SKU: {product.sku}</span>
            )}
          </div>

          <div className="mb-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold">
              {formatProductPrice(product.price, product.currency, product.priceUnit)}
            </span>
            {product.compareAtPrice && (
              <>
                <span className="text-lg text-muted line-through">
                  {formatPrice(product.compareAtPrice, product.currency)}
                </span>
                {discount && (
                  <Badge variant="destructive">-{discount}%</Badge>
                )}
              </>
            )}
          </div>

          <p className="mb-6 leading-relaxed text-muted">
            {product.shortDescription}
          </p>

          <div className="mb-6 flex items-center gap-4">
            <span className="text-sm font-medium">Quantity</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-9 w-9 items-center justify-center border border-border hover:bg-accent-muted"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-semibold">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-9 w-9 items-center justify-center border border-border hover:bg-accent-muted"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {product.purchasingMode !== "quote_only" && (
              <Button onClick={handleAddToCart} size="lg" className="w-full">
                <ShoppingCart className="h-5 w-5" />
                Add to Cart
              </Button>
            )}
            {product.purchasingMode !== "buy_online" && (
              <Button asChild size="lg" variant={product.purchasingMode === "quote_only" ? "default" : "outline"} className="w-full">
                <Link href={`/quote?product=${product.id}`}>
                  <FileText className="h-5 w-5" />
                  Request a Quote
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => {
                toggleItem(product.id);
                toast.success(
                  inWishlist ? "Removed from wishlist" : "Added to wishlist"
                );
              }}
            >
              <Heart
                className={cn("h-5 w-5", inWishlist && "fill-destructive text-destructive")}
              />
              {inWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display mb-4 text-2xl font-bold">Description</h2>
          <p className="leading-relaxed text-muted">{product.description}</p>
        </div>
        <div>
          <h2 className="font-display mb-4 text-2xl font-bold">
            Specifications
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(product.specifications).map(
                  ([key, value], i) => (
                    <tr
                      key={key}
                      className={cn(
                        "border-b border-border",
                        i % 2 === 0 && "bg-accent-light/20"
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{key}</td>
                      <td className="px-4 py-3 text-muted">{value}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display mb-8 text-2xl font-bold">
            Related Products
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
