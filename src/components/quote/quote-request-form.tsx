"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/utils";

export interface QuoteFormProduct {
  id: string;
  name: string;
  sku?: string;
  price: number;
  currency: string;
}

interface QuoteItemRow {
  productId: string;
  quantity: string;
  requestedPrice: string;
  note: string;
}

interface QuoteRequestFormProps {
  products: QuoteFormProduct[];
  initialProductId?: string;
  initialContact?: { name?: string; email?: string };
  loggedIn: boolean;
}

function emptyRow(productId = ""): QuoteItemRow {
  return { productId, quantity: "1", requestedPrice: "", note: "" };
}

/**
 * Formalized `/quote` form (Phase 11) — real client + server validation, submits to
 * POST /api/quotes, and persists a real Quote + QuoteItem rows with status NEW.
 * Guest-submittable by design (no session required — see /api/quotes/route.ts);
 * `loggedIn` only controls the post-submit redirect (to /account/quotes for a
 * logged-in submitter, since they can look the quote up there; a guest gets an inline
 * confirmation instead — see Quote's schema comment on why guest quotes can't be
 * looked up later).
 */
export function QuoteRequestForm({
  products,
  initialProductId,
  initialContact,
  loggedIn,
}: QuoteRequestFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialContact?.name ?? "");
  const [email, setEmail] = useState(initialContact?.email ?? "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<QuoteItemRow[]>([
    emptyRow(initialProductId ?? products[0]?.id ?? ""),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function updateItem(index: number, patch: Partial<QuoteItemRow>) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyRow(products[0]?.id ?? "")]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError("Full name and email are required.");
      return;
    }
    if (items.some((row) => !row.productId)) {
      setError("Choose a product for every line, or remove the empty line.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          message: message.trim() || undefined,
          items: items.map((row) => ({
            productId: row.productId,
            quantity: Number(row.quantity) || 1,
            requestedPrice: row.requestedPrice ? Number(row.requestedPrice) : undefined,
            note: row.note.trim() || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submitting your quote request failed.");
      }

      toast.success("Quote request submitted — our team will respond soon.");
      if (loggedIn) {
        router.push("/account/quotes");
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submitting your quote request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-accent-light/30 p-8 text-center">
        <h2 className="font-display mb-2 text-xl font-semibold">Request received</h2>
        <p className="text-sm text-muted">
          Thank you — your quote request has been submitted. Our team will reach out to{" "}
          {email} shortly with pricing.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Products *</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </div>
        {items.map((row, index) => {
          const product = products.find((p) => p.id === row.productId);
          return (
            <div
              key={index}
              className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <div>
                <Label htmlFor={`product-${index}`} className="text-xs">
                  Product
                </Label>
                <select
                  id={`product-${index}`}
                  value={row.productId}
                  onChange={(e) => updateItem(index, { productId: e.target.value })}
                  className="mt-1 h-9 w-full border border-border-strong bg-background px-2 text-sm"
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? ` (${p.sku})` : ""}
                    </option>
                  ))}
                </select>
                {product && (
                  <p className="mt-1 text-xs text-muted">
                    Listed price: {formatPrice(product.price, product.currency)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`quantity-${index}`} className="text-xs">
                  Quantity
                </Label>
                <Input
                  id={`quantity-${index}`}
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor={`requested-price-${index}`} className="text-xs">
                  Your target price (optional)
                </Label>
                <Input
                  id={`requested-price-${index}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.requestedPrice}
                  onChange={(e) => updateItem(index, { requestedPrice: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={items.length <= 1}
                  onClick={() => removeItem(index)}
                  aria-label="Remove product"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your requirements, quantities, and timeline..."
          className="mt-1.5"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Submitting…" : "Submit Quote Request"}
      </Button>
    </form>
  );
}
