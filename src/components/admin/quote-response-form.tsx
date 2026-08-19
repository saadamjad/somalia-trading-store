"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface QuoteResponseItem {
  id: string;
  productName: string;
  quantity: number;
  requestedPrice: number | null;
  quotedUnitPrice: number | null;
}

interface QuoteResponseFormProps {
  quoteId: string;
  items: QuoteResponseItem[];
  initialAdminNote: string | null;
}

/**
 * Admin pricing response — sets `quotedUnitPrice` on every item and moves the quote to
 * QUOTED (PATCH /api/admin/quotes/[id] with the `items` shape — see that route's
 * comment). Every item requires a price; the server re-validates that the submitted
 * item ids exactly match the quote's own items.
 */
export function QuoteResponseForm({ quoteId, items, initialAdminNote }: QuoteResponseFormProps) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(
      items.map((item) => [item.id, item.quotedUnitPrice !== null ? String(item.quotedUnitPrice) : ""])
    )
  );
  const [adminNote, setAdminNote] = useState(initialAdminNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedItems = items.map((item) => ({
      id: item.id,
      quotedUnitPrice: Number(prices[item.id]),
    }));

    if (parsedItems.some((item) => !Number.isFinite(item.quotedUnitPrice) || item.quotedUnitPrice < 0)) {
      setError("Enter a valid, non-negative price for every item.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsedItems, adminNote: adminNote.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Responding to this quote failed.");
      }

      toast.success("Quote priced and moved to QUOTED.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Responding to this quote failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
            <div className="text-sm">
              <p className="font-medium">{item.productName}</p>
              <p className="text-xs text-muted">
                Qty {item.quantity}
                {item.requestedPrice !== null && (
                  <> &middot; customer asked for ${item.requestedPrice.toFixed(2)}/unit</>
                )}
              </p>
            </div>
            <div>
              <Label htmlFor={`price-${item.id}`} className="text-xs">
                Unit price
              </Label>
              <Input
                id={`price-${item.id}`}
                type="number"
                min={0}
                step="0.01"
                value={prices[item.id] ?? ""}
                onChange={(e) => setPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
        ))}
      </div>
      <div>
        <Label htmlFor="quote-admin-note" className="text-xs">
          Note to customer (optional)
        </Label>
        <Textarea
          id="quote-admin-note"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Visible to the customer — e.g. lead time, bulk-discount terms."
          className="min-h-[80px]"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving…" : "Send Quote"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </form>
  );
}
