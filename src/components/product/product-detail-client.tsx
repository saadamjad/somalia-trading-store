"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Heart, Minus, Plus, ShoppingCart, FileText } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product/product-card";
import { ProductReviews } from "@/components/product/product-reviews";
import { SafeImage } from "@/components/ui/safe-image";
import type { Product, Availability } from "@/lib/types/product";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useUIStore } from "@/stores/ui-store";
import {
  calculateDiscount,
  cn,
  formatPrice,
  formatProductPrice,
} from "@/lib/utils";

export interface ProductVariantOption {
  id: string;
  attributes: Record<string, string>;
  label: string;
  price: number | null;
  image: string | null;
  active: boolean;
  quantity: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

interface ProductDetailClientProps {
  product: Product;
  related: Product[];
  categoryName: string;
  variants: ProductVariantOption[];
}

export function ProductDetailClient({
  product,
  related,
  categoryName,
  variants,
}: ProductDetailClientProps) {
  const t = useTranslations("product");
  const availabilityLabels: Record<Availability, string> = {
    in_stock: t("availability.inStock"),
    limited: t("availability.limited"),
    out_of_stock: t("availability.outStock"),
    made_to_order: t("availability.madeToOrder"),
  };
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useUIStore((s) => s.openCart);
  const { isInWishlist, toggleItem } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);

  // Attribute keys in the order they first appear (e.g. "size", "color"), each with
  // the set of values any active variant offers for it.
  const attributeOptions = new Map<string, Set<string>>();
  for (const v of variants) {
    for (const [key, value] of Object.entries(v.attributes)) {
      if (!attributeOptions.has(key)) attributeOptions.set(key, new Set());
      attributeOptions.get(key)!.add(value);
    }
  }
  const hasVariants = variants.length > 0;

  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});

  const selectedVariant = hasVariants
    ? (variants.find((v) =>
        [...attributeOptions.keys()].every((key) => selectedAttributes[key] === v.attributes[key])
      ) ?? null)
    : null;

  const effectivePrice = selectedVariant?.price ?? product.price;
  const discount = calculateDiscount(effectivePrice, product.compareAtPrice);
  const variantStockBlocked = hasVariants && (!selectedVariant || selectedVariant.status === "out_of_stock");

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariant) {
      toast.error(t("actions.selectOptionFirst"));
      return;
    }
    addItem(product.id, quantity, selectedVariant?.id);
    openCart();
    toast.success(t("actions.addedToCart", { name: product.name }));
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
              {t("breadcrumb.home")}
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
              <SafeImage
                src={product.images[selectedImage] ?? null}
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
                    "relative h-20 w-20 overflow-hidden rounded-lg border-2 transition-all duration-(--duration-base)",
                    selectedImage === i
                      ? "border-accent"
                      : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  aria-label={t("gallery.viewImage", { index: i + 1 })}
                >
                  <SafeImage
                    src={img}
                    alt=""
                    fill
                    sizes="80px"
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
              <span className="text-sm text-muted">{t("sku", { sku: product.sku })}</span>
            )}
          </div>

          <div className="mb-6 flex items-baseline gap-3">
            <span className="text-3xl font-bold">
              {formatProductPrice(effectivePrice, product.currency, product.priceUnit)}
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

          {hasVariants && (
            <div className="mb-6 space-y-4">
              {[...attributeOptions.entries()].map(([key, values]) => (
                <div key={key}>
                  <span className="mb-2 block text-sm font-medium capitalize">{key}</span>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={key}>
                    {[...values].map((value) => {
                      const isSelected = selectedAttributes[key] === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() =>
                            setSelectedAttributes((prev) => ({ ...prev, [key]: value }))
                          }
                          className={cn(
                            "border px-3 py-1.5 text-sm",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          )}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedVariant && selectedVariant.status === "out_of_stock" && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {t("variants.outOfStock")}
                </p>
              )}
              {!selectedVariant && Object.keys(selectedAttributes).length > 0 && (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {t("variants.unavailable")}
                </p>
              )}
            </div>
          )}

          <div className="mb-6 flex items-center gap-4">
            <span className="text-sm font-medium">{t("quantity.label")}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-9 w-9 items-center justify-center border border-border hover:bg-accent-muted"
                aria-label={t("quantity.decrease")}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center font-semibold">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-9 w-9 items-center justify-center border border-border hover:bg-accent-muted"
                aria-label={t("quantity.increase")}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {product.purchasingMode !== "quote_only" && (
              <Button
                onClick={handleAddToCart}
                size="lg"
                className="w-full"
                disabled={variantStockBlocked}
              >
                <ShoppingCart className="h-5 w-5" />
                {t("actions.addToCart")}
              </Button>
            )}
            {product.purchasingMode !== "buy_online" && (
              <Button asChild size="lg" variant={product.purchasingMode === "quote_only" ? "default" : "outline"} className="w-full">
                <Link href={`/quote?product=${product.id}`}>
                  <FileText className="h-5 w-5" />
                  {t("actions.requestQuote")}
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
                  inWishlist ? t("actions.removedFromWishlist") : t("actions.addedToWishlist")
                );
              }}
            >
              <Heart
                className={cn("h-5 w-5", inWishlist && "fill-destructive text-destructive")}
              />
              {inWishlist ? t("actions.removeFromWishlist") : t("actions.addToWishlist")}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display mb-4 text-2xl font-bold">{t("description.title")}</h2>
          <p className="leading-relaxed text-muted">{product.description}</p>
        </div>
        <div>
          <h2 className="font-display mb-4 text-2xl font-bold">
            {t("specifications.title")}
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

      <ProductReviews productId={product.id} />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display mb-8 text-2xl font-bold">
            {t("related.title")}
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
