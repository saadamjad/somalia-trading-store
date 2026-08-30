"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCartStore } from "@/stores/cart-store";
import { useCartProducts } from "@/hooks/use-cart-products";
import { useUIStore } from "@/stores/ui-store";
import { formatPrice, formatProductPrice } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";

export function MiniCartDrawer() {
  const { isCartOpen, closeCart } = useUIStore();
  const { updateQuantity, removeItem } = useCartStore();
  const { lineItems: items, subtotal } = useCartProducts();

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Your Cart ({items.length})
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Your cart is empty"
              description="Browse our products and add items to get started."
              action={
                <Button asChild onClick={closeCart}>
                  <Link href="/shop">Shop Products</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-4">
              {items.map(({ product, quantity, variant, unitPrice }) => (
                <li
                  key={`${product.id}::${variant?.id ?? ""}`}
                  className="flex gap-4 border-b border-border pb-4"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                    <SafeImage
                      src={variant?.image ?? product.images[0]}
                      alt={product.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <Link
                      href={`/shop/${product.category}/${product.slug}`}
                      onClick={closeCart}
                      className="font-display line-clamp-2 text-sm font-semibold hover:text-primary"
                    >
                      {product.name}
                    </Link>
                    {variant && <p className="text-xs text-muted">{variant.label}</p>}
                    <p className="mt-1 text-sm font-bold">
                      {formatProductPrice(unitPrice, product.currency, product.priceUnit)}
                    </p>
                    <div className="mt-auto flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1, variant?.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent-light"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1, variant?.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-accent-light"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(product.id, variant?.id)}
                        className="ml-auto text-muted hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-6">
            <div className="mb-4 flex justify-between text-base font-semibold">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="space-y-2">
              <Button asChild className="w-full" onClick={closeCart}>
                <Link href="/cart">View Cart</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full"
                onClick={closeCart}
              >
                <Link href="/shop">
                  Continue Shopping
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                className="w-full"
                onClick={closeCart}
              >
                <Link href="/checkout">Proceed to Checkout</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
