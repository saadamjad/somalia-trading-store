"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/utils";

interface VariantRow {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  label: string;
  price: number | null;
  image: string | null;
  active: boolean;
  quantity: number;
  lowStockThreshold: number;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

const STATUS_BADGE: Record<VariantRow["status"], "success" | "secondary" | "destructive"> = {
  in_stock: "success",
  low_stock: "secondary",
  out_of_stock: "destructive",
};

const EMPTY_FORM = { sku: "", size: "", color: "", price: "", initialStock: "0" };

/**
 * Self-contained variant manager for the admin product edit page — fetches/mutates
 * directly against /api/products/[id]/variants* rather than relying on server-passed
 * data, since it needs to refresh its own list after every mutation without a full
 * page reload. Only rendered on the EDIT page (a product must exist first — variants
 * are keyed by a real productId FK).
 */
export function VariantManager({ productId }: { productId: string }) {
  const [variants, setVariants] = useState<VariantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [deltaByVariant, setDeltaByVariant] = useState<Record<string, string>>({});

  async function load() {
    try {
      const res = await fetch(`/api/products/${productId}/variants`);
      if (!res.ok) throw new Error("Failed to load variants.");
      const data = await res.json();
      setVariants(data.items);
    } catch {
      setError("Couldn't load variants.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products/${productId}/variants`);
        if (cancelled) return;
        if (!res.ok) throw new Error("Failed to load variants.");
        const data = await res.json();
        if (!cancelled) setVariants(data.items);
      } catch {
        if (!cancelled) setError("Couldn't load variants.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || (!form.size.trim() && !form.color.trim())) {
      toast.error("SKU and at least one attribute (size or color) are required.");
      return;
    }
    setCreating(true);
    try {
      const attributes: Record<string, string> = {};
      if (form.size.trim()) attributes.size = form.size.trim();
      if (form.color.trim()) attributes.color = form.color.trim();

      const res = await fetch(`/api/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: form.sku.trim(),
          attributes,
          price: form.price ? Number(form.price) : null,
          initialStock: Number(form.initialStock) || 0,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create variant.");
      }
      toast.success("Variant created.");
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create variant.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(variant: VariantRow) {
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !variant.active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update variant.");
      }
      toast.success(variant.active ? "Variant deactivated." : "Variant activated.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update variant.");
    }
  }

  async function handleDelete(variant: VariantRow) {
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variant.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete variant.");
      }
      toast.success("Variant deleted.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete variant.");
    }
  }

  async function handleAdjustStock(variant: VariantRow) {
    const delta = Number(deltaByVariant[variant.id]);
    if (!Number.isInteger(delta) || delta === 0) {
      toast.error("Enter a non-zero whole number.");
      return;
    }
    setAdjusting(variant.id);
    try {
      const res = await fetch(`/api/products/${productId}/variants/${variant.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delta, reason: "MANUAL_ADJUSTMENT" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Stock adjustment failed.");
      }
      toast.success("Stock updated.");
      setDeltaByVariant((d) => ({ ...d, [variant.id]: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stock adjustment failed.");
    } finally {
      setAdjusting(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Variants</h2>
        <p className="text-sm text-muted">
          Optional. Add size/color variants with their own SKU, price override, and
          stock. Leave empty for a plain, single-SKU product.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {variants && variants.length > 0 && (
          <div className="overflow-x-auto border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Attributes</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Adjust Stock</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-mono">{v.sku}</td>
                    <td className="px-3 py-2">{v.label}</td>
                    <td className="px-3 py-2">{v.price !== null ? formatPrice(v.price) : "—"}</td>
                    <td className="px-3 py-2">{v.quantity}</td>
                    <td className="px-3 py-2">
                      <Badge variant={STATUS_BADGE[v.status]}>{v.status.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => toggleActive(v)}>
                        {v.active ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          step={1}
                          className="w-20"
                          value={deltaByVariant[v.id] ?? ""}
                          onChange={(e) =>
                            setDeltaByVariant((d) => ({ ...d, [v.id]: e.target.value }))
                          }
                          placeholder="±qty"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={adjusting === v.id}
                          onClick={() => handleAdjustStock(v)}
                        >
                          Apply
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(v)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleCreate} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-5">
          <div>
            <Label htmlFor="variant-sku">SKU *</Label>
            <Input
              id="variant-sku"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="variant-size">Size</Label>
            <Input
              id="variant-size"
              value={form.size}
              onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
              className="mt-1.5"
              placeholder="e.g. M"
            />
          </div>
          <div>
            <Label htmlFor="variant-color">Color</Label>
            <Input
              id="variant-color"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              className="mt-1.5"
              placeholder="e.g. Black"
            />
          </div>
          <div>
            <Label htmlFor="variant-price">Price Override</Label>
            <Input
              id="variant-price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="mt-1.5"
              placeholder="Uses product price"
            />
          </div>
          <div>
            <Label htmlFor="variant-initial-stock">Initial Stock</Label>
            <Input
              id="variant-initial-stock"
              type="number"
              min="0"
              step="1"
              value={form.initialStock}
              onChange={(e) => setForm((f) => ({ ...f, initialStock: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-5">
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? "Adding…" : "Add Variant"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
