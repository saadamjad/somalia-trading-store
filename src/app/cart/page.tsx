"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCartStore } from "@/stores/cart-store";
import { useCartProducts } from "@/hooks/use-cart-products";
import { useCartStockValidation, stockIssueKey } from "@/hooks/use-cart-stock-validation";
import { formatPrice, formatProductPrice } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";

export default function CartPage() {
  const t = useTranslations("cart");
  const { updateQuantity, removeItem, clearCart } = useCartStore();
  const { lineItems: items, subtotal, isLoading } = useCartProducts();
  // Phase 7: stock validation before checkout — flags any line item whose requested
  // quantity now exceeds current inventory, so the customer sees it here rather than
  // discovering it at checkout (checkout itself is Phase 8).
  const stockIssues = useCartStockValidation();
  const hasStockIssues = Object.keys(stockIssues).length > 0;
  const shipping = subtotal > 0 ? 0 : 0;
  const total = subtotal + shipping;

  if (!isLoading && items.length === 0) {
    return (
      <div className="container-custom min-h-[60vh] py-24">
        <EmptyState
          icon={ShoppingBag}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Button asChild size="lg">
              <Link href="/shop">{t("empty.cta")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="container-custom py-24 md:py-28">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold md:text-4xl">
          {t("title")}
        </h1>
        <button
          onClick={clearCart}
          className="text-sm text-muted hover:text-destructive"
        >
          {t("clearCart")}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map(({ product, quantity, variant, unitPrice }) => {
            const issue = stockIssues[stockIssueKey(product.id, variant?.id)];
            return (
              <Card key={`${product.id}::${variant?.id ?? ""}`}>
                <CardContent className="flex gap-4 p-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                    <SafeImage
                      src={variant?.image ?? product.images[0]}
                      alt={product.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link
                        href={`/shop/${product.category}/${product.slug}`}
                        className="font-display font-semibold hover:text-primary"
                      >
                        {product.name}
                      </Link>
                      {variant && <p className="text-sm text-muted">{variant.label}</p>}
                      {!variant && <p className="text-sm text-muted">{product.subcategory}</p>}
                      <p className="mt-1 font-bold">
                        {formatProductPrice(unitPrice, product.currency, product.priceUnit)}
                      </p>
                      {issue && (
                        <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                          {t("stockIssue", { available: issue.available })}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex items-center gap-4 sm:mt-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(product.id, quantity - 1, variant?.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent-light"
                          aria-label={t("decreaseQuantity")}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium">
                          {quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(product.id, quantity + 1, variant?.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-accent-light"
                          aria-label={t("increaseQuantity")}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(product.id, variant?.id)}
                        className="text-muted hover:text-destructive"
                        aria-label={t("removeItem")}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div>
          <Card className="sticky top-24">
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-xl font-semibold">
                {t("summary.title")}
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">{t("summary.subtotal")}</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t("summary.shipping")}</span>
                  <span className="text-muted">
                    {t("summary.shippingCalculated")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">{t("summary.discount")}</span>
                  <span className="text-muted">{t("summary.discountNone")}</span>
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("summary.total")}</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>
              {hasStockIssues && (
                <p role="alert" className="text-xs text-destructive">
                  {t("stockIssuesWarning")}
                </p>
              )}
              <Button asChild className="w-full" size="lg" disabled={hasStockIssues}>
                <Link
                  href="/checkout"
                  aria-disabled={hasStockIssues}
                  onClick={(e) => hasStockIssues && e.preventDefault()}
                >
                  {t("proceedToCheckout")}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/shop">
                  {t("continueShopping")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
