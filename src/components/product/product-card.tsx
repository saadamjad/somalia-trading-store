"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Heart, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/types/product";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useUIStore } from "@/stores/ui-store";
import { calculateDiscount, cn, formatPrice, formatProductPrice } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  variant?: "grid" | "editorial";
  className?: string;
}

export function ProductCard({
  product,
  variant = "grid",
  className,
}: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCart);
  const { isInWishlist, toggleItem } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);
  const discount = calculateDiscount(product.price, product.compareAtPrice);
  const productUrl = `/shop/${product.category}/${product.slug}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product.id);
    openCart();
    toast.success(`${product.name} added to cart`);
  };

  if (variant === "editorial") {
    return (
      <article
        className={cn(
          "group grid overflow-hidden border border-border bg-surface md:grid-cols-2",
          className
        )}
      >
        <Link
          href={productUrl}
          className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[420px]"
        >
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        </Link>

        <div className="flex flex-col justify-center p-8 md:p-12 lg:p-16">
          <span className="label mb-4">{product.subcategory}</span>
          <Link href={productUrl}>
            <h3 className="font-display mb-4 text-2xl font-bold leading-tight transition-colors hover:text-accent md:text-3xl">
              {product.name}
            </h3>
          </Link>
          <p className="mb-8 text-sm leading-relaxed text-muted">
            {product.shortDescription}
          </p>
          <div className="mb-8 flex items-baseline gap-3">
            <span className="font-display text-3xl font-bold">
              {formatProductPrice(product.price, product.currency, product.priceUnit)}
            </span>
            {product.compareAtPrice && (
              <>
                <span className="text-muted line-through">
                  {formatPrice(product.compareAtPrice, product.currency)}
                </span>
                {discount && (
                  <span className="text-xs font-semibold text-accent-text">
                    −{discount}%
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAddToCart}
              className="inline-flex h-12 items-center gap-2 bg-foreground px-7 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
            >
              <ShoppingCart className="h-4 w-4" />
              Add to Cart
            </button>
            <button
              onClick={() => {
                toggleItem(product.id);
                toast.success(
                  inWishlist ? "Removed from wishlist" : "Added to wishlist"
                );
              }}
              aria-label={
                inWishlist ? "Remove from wishlist" : "Add to wishlist"
              }
              className={cn(
                "inline-flex h-12 w-12 items-center justify-center border border-border-strong transition-colors hover:border-foreground",
                inWishlist && "border-accent text-accent"
              )}
            >
              <Heart
                className={cn("h-4 w-4", inWishlist && "fill-current")}
                strokeWidth={1.5}
              />
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("group", className)}>
      <Link
        href={productUrl}
        className="relative mb-5 block aspect-[3/4] overflow-hidden bg-muted/10 shadow-(--shadow-sm) transition-shadow duration-500 group-hover:shadow-(--shadow-lg)"
      >
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
        <button
          onClick={(e) => {
            e.preventDefault();
            toggleItem(product.id);
            toast.success(
              inWishlist ? "Removed from wishlist" : "Added to wishlist"
            );
          }}
          aria-label={
            inWishlist ? "Remove from wishlist" : "Add to wishlist"
          }
          className={cn(
            "absolute right-4 top-4 flex h-9 w-9 items-center justify-center bg-white/90 shadow-(--shadow-sm) transition-all duration-(--duration-base) hover:scale-110 hover:bg-white",
            inWishlist && "text-accent"
          )}
        >
          <Heart
            className={cn("h-3.5 w-3.5", inWishlist && "fill-current")}
            strokeWidth={1.5}
          />
        </button>
        {discount && (
          <span className="absolute left-4 top-4 bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground">
            −{discount}%
          </span>
        )}
      </Link>

      <div>
        <p className="label mb-2">{product.subcategory}</p>
        <Link href={productUrl}>
          <h3 className="font-display mb-2 text-base font-semibold leading-snug transition-colors group-hover:text-accent">
            {product.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {formatProductPrice(product.price, product.currency, product.priceUnit)}
          </span>
          <button
            onClick={handleAddToCart}
            className="flex h-8 w-8 items-center justify-center border border-border-strong transition-all duration-(--duration-base) hover:border-foreground hover:bg-foreground hover:text-background"
            aria-label="Add to cart"
          >
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </article>
  );
}
