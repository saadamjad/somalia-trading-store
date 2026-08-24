"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { useCartProducts } from "@/hooks/use-cart-products";
import { formatPrice } from "@/lib/utils";

export interface CheckoutAddressDTO {
  id: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

interface NewAddressForm {
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

const EMPTY_NEW_ADDRESS: NewAddressForm = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

interface StockIssue {
  productId: string;
  requested: number;
  available: number;
}

export function CheckoutForm({
  customer,
  initialAddresses,
}: {
  /** null when checking out as a guest (no session) — see checkout/page.tsx. */
  customer: { name: string; email: string } | null;
  initialAddresses: CheckoutAddressDTO[];
}) {
  const router = useRouter();
  const { items: rawItems, clearCart } = useCartStore();
  const { lineItems: items, subtotal, isLoading } = useCartProducts();

  const defaultAddress = initialAddresses.find((a) => a.isDefault) ?? initialAddresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    defaultAddress?.id ?? null
  );
  const [useNewAddress, setUseNewAddress] = useState(initialAddresses.length === 0);
  const [newAddress, setNewAddress] = useState<NewAddressForm>(EMPTY_NEW_ADDRESS);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);

  const setNewAddressField = (key: keyof NewAddressForm, value: string) =>
    setNewAddress((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStockIssues([]);

    if (!customer && (!guestName.trim() || !guestEmail.trim())) {
      setError("Please enter your name and email.");
      return;
    }

    if (!useNewAddress && !selectedAddressId) {
      setError("Please select a shipping address.");
      return;
    }

    setSubmitting(true);
    try {
      const body = customer
        ? {
            ...(useNewAddress
              ? { shippingAddress: newAddress }
              : { addressId: selectedAddressId }),
            ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
          }
        : {
            name: guestName.trim(),
            email: guestEmail.trim(),
            shippingAddress: newAddress,
            items: rawItems,
            ...(customerNote.trim() ? { customerNote: customerNote.trim() } : {}),
          };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data.issues)) {
          setStockIssues(data.issues);
        }
        throw new Error(data.error || "Could not place your order.");
      }

      // Server has already persisted the order, decremented inventory, and cleared
      // the server cart (logged-in path only — see order-service.ts createGuestOrder)
      // inside one transaction — clearing the local store here just keeps the client
      // UI in sync with that already-committed server state.
      clearCart();
      toast.success("Order placed.");
      // A guest has no session, so /account/orders/[id] (an authenticated route)
      // isn't reachable — show an unauthenticated confirmation instead.
      router.push(
        customer
          ? `/account/orders/${data.item.id}?placed=1`
          : `/checkout/confirmation?orderNumber=${encodeURIComponent(data.item.orderNumber)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place your order.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoading && items.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center py-12 text-center">
        <h2 className="font-display mb-4 text-2xl font-bold">Nothing to Checkout</h2>
        <p className="mb-8 text-muted">Add products to your cart first.</p>
        <Button asChild>
          <Link href="/shop">Shop Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-2 p-6">
            <h2 className="font-display text-lg font-semibold">Contact Information</h2>
            {customer ? (
              <p className="text-sm text-muted">
                {customer.name} &middot; {customer.email}
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-muted">
                  Checking out as a guest.{" "}
                  <Link href="/login?callbackUrl=/checkout" className="font-medium text-accent underline">
                    Log in
                  </Link>{" "}
                  if you have an account.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="guestName">Full Name *</Label>
                    <Input
                      id="guestName"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="guestEmail">Email *</Label>
                    <Input
                      id="guestEmail"
                      type="email"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Shipping Address</h2>

            {initialAddresses.length > 0 && (
              <div className="space-y-3">
                {initialAddresses.map((address) => (
                  <label
                    key={address.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-muted"
                  >
                    <input
                      type="radio"
                      name="addressId"
                      value={address.id}
                      checked={!useNewAddress && selectedAddressId === address.id}
                      onChange={() => {
                        setUseNewAddress(false);
                        setSelectedAddressId(address.id);
                      }}
                      className="mt-1"
                    />
                    <span>
                      <span className="mb-1 flex items-center gap-2 font-semibold">
                        {address.recipientName}
                        {address.isDefault && <Badge variant="success">Default</Badge>}
                      </span>
                      <span className="block text-muted">{address.phone}</span>
                      <span className="block text-muted">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}
                      </span>
                      <span className="block text-muted">
                        {[address.city, address.region, address.postalCode]
                          .filter(Boolean)
                          .join(", ")}
                        , {address.country}
                      </span>
                    </span>
                  </label>
                ))}

                <button
                  type="button"
                  onClick={() => setUseNewAddress(true)}
                  className={`w-full rounded-lg border p-4 text-left text-sm font-medium ${
                    useNewAddress
                      ? "border-accent bg-accent-muted"
                      : "border-dashed border-border hover:border-accent"
                  }`}
                >
                  Use a new address
                </button>
              </div>
            )}

            {useNewAddress && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="recipientName">Recipient Name *</Label>
                  <Input
                    id="recipientName"
                    required
                    value={newAddress.recipientName}
                    onChange={(e) => setNewAddressField("recipientName", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={newAddress.phone}
                    onChange={(e) => setNewAddressField("phone", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="line1">Address Line 1 *</Label>
                  <Input
                    id="line1"
                    required
                    value={newAddress.line1}
                    onChange={(e) => setNewAddressField("line1", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="line2">Address Line 2 (optional)</Label>
                  <Input
                    id="line2"
                    value={newAddress.line2}
                    onChange={(e) => setNewAddressField("line2", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    required
                    value={newAddress.city}
                    onChange={(e) => setNewAddressField("city", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="region">Region (optional)</Label>
                  <Input
                    id="region"
                    value={newAddress.region}
                    onChange={(e) => setNewAddressField("region", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal Code (optional)</Label>
                  <Input
                    id="postalCode"
                    value={newAddress.postalCode}
                    onChange={(e) => setNewAddressField("postalCode", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    required
                    value={newAddress.country}
                    onChange={(e) => setNewAddressField("country", e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Order Note (optional)</h2>
            <Textarea
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Delivery instructions or anything else we should know."
              rows={3}
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="sticky top-24">
          <CardContent className="space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Order Summary</h2>
            <ul className="space-y-3 border-b border-border pb-4">
              {items.map(({ product, quantity }) => (
                <li key={product.id} className="flex justify-between text-sm">
                  <span>
                    {product.name} × {quantity}
                  </span>
                  <span className="font-medium">{formatPrice(product.price * quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {stockIssues.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {stockIssues.map((issue) => (
                  <li key={issue.productId}>
                    Only {issue.available} available (you requested {issue.requested}).
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-muted">
              No online payment is collected at this time — your order will be confirmed
              and paid for outside the platform. Payment integration is coming in a
              future update.
            </p>

            <Button type="submit" className="w-full" size="lg" disabled={submitting || isLoading}>
              {submitting ? "Placing Order…" : "Place Order"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
