"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useCartStore } from "@/stores/cart-store";
import { formatPrice } from "@/lib/utils";

export default function CheckoutPage() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const { getItemsWithProducts, getSubtotal, clearCart } = useCartStore();
  const items = getItemsWithProducts();
  const subtotal = getSubtotal();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast.info("This is a preview checkout — no order was placed.");
  };

  if (items.length === 0 && !submitted) {
    return (
      <div className="container-custom flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display mb-4 text-3xl font-bold">
          Nothing to Checkout
        </h1>
        <p className="mb-8 text-muted">Add products to your cart first.</p>
        <Button asChild>
          <Link href="/shop">Shop Products</Link>
        </Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container-custom flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <CheckCircle2 className="mb-6 h-16 w-16 text-success" />
        <h1 className="font-display mb-4 text-3xl font-bold">
          Preview Order Complete
        </h1>
        <p className="mb-8 max-w-md text-muted">
          This is a demo checkout experience. Payment and order processing are
          not connected. In the full platform, your order would be submitted
          here.
        </p>
        <Button
          onClick={() => {
            clearCart();
            router.push("/");
          }}
        >
          Return to Homepage
        </Button>
      </div>
    );
  }

  return (
    <div className="container-custom py-24 md:py-28">
      <div className="mb-8 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent-light p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div>
          <p className="font-semibold text-accent">Preview Checkout</p>
          <p className="text-sm text-muted">
            This is a preview checkout. Payment and order processing are not
            connected.
          </p>
        </div>
      </div>

      <h1 className="font-display mb-8 text-3xl font-bold">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">
                Contact Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input id="firstName" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input id="lastName" required className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" className="mt-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">
                Shipping Address
              </h2>
              <div>
                <Label htmlFor="address">Address *</Label>
                <Input id="address" required className="mt-1.5" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input id="city" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" className="mt-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardContent className="space-y-4 p-6">
              <h2 className="font-display text-lg font-semibold">
                Order Summary
              </h2>
              <ul className="space-y-3 border-b border-border pb-4">
                {items.map(({ product, quantity }) => (
                  <li
                    key={product.id}
                    className="flex justify-between text-sm"
                  >
                    <span>
                      {product.name} × {quantity}
                    </span>
                    <span className="font-medium">
                      {formatPrice(product.price * quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <Button type="submit" className="w-full" size="lg">
                Place Order (Preview)
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
