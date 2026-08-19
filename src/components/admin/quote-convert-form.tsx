"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddressOption {
  id: string;
  label: string;
}

interface QuoteConvertFormProps {
  quoteId: string;
  addresses: AddressOption[];
}

/**
 * Converts an ACCEPTED quote into a real Order (POST /api/admin/quotes/[id]/convert).
 * Deliberately admin-triggered, not self-service — a B2B-style manual sales process
 * (quote-service.ts `convertToOrder`'s comment has the full rationale). Requires a
 * shipping destination: either one of the customer's saved addresses, or an inline
 * one-off address entered here.
 */
export function QuoteConvertForm({ quoteId, addresses }: QuoteConvertFormProps) {
  const router = useRouter();
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [useInline, setUseInline] = useState(addresses.length === 0);
  const [inline, setInline] = useState({
    recipientName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body = useInline
      ? {
          shippingAddress: {
            ...inline,
            line2: inline.line2 || undefined,
            region: inline.region || undefined,
            postalCode: inline.postalCode || undefined,
          },
        }
      : { addressId };

    if (!useInline && !addressId) {
      setError("Choose a shipping address.");
      return;
    }
    if (useInline && (!inline.recipientName || !inline.phone || !inline.line1 || !inline.city || !inline.country)) {
      setError("Fill in recipient name, phone, address line, city, and country.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Converting this quote failed.");
      }

      const data = await res.json();
      toast.success(`Order ${data.order.orderNumber} created.`);
      router.push(`/admin/orders/${data.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Converting this quote failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {addresses.length > 0 && (
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!useInline}
              onChange={() => setUseInline(false)}
            />
            Use a saved address
          </label>
          {!useInline && (
            <select
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
              className="h-9 w-full max-w-md border border-border-strong bg-background px-3 text-sm"
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2">
            <input type="radio" checked={useInline} onChange={() => setUseInline(true)} />
            Enter a one-off address
          </label>
        </div>
      )}

      {useInline && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="convert-recipient" className="text-xs">
              Recipient name
            </Label>
            <Input
              id="convert-recipient"
              value={inline.recipientName}
              onChange={(e) => setInline((prev) => ({ ...prev, recipientName: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="convert-phone" className="text-xs">
              Phone
            </Label>
            <Input
              id="convert-phone"
              value={inline.phone}
              onChange={(e) => setInline((prev) => ({ ...prev, phone: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="convert-line1" className="text-xs">
              Address line
            </Label>
            <Input
              id="convert-line1"
              value={inline.line1}
              onChange={(e) => setInline((prev) => ({ ...prev, line1: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="convert-city" className="text-xs">
              City
            </Label>
            <Input
              id="convert-city"
              value={inline.city}
              onChange={(e) => setInline((prev) => ({ ...prev, city: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="convert-country" className="text-xs">
              Country
            </Label>
            <Input
              id="convert-country"
              value={inline.country}
              onChange={(e) => setInline((prev) => ({ ...prev, country: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Converting…" : "Convert to Order"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </form>
  );
}
