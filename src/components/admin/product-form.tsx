"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageGalleryUploadField } from "@/components/admin/image-gallery-upload-field";
import type { Category, Product } from "@/lib/types/product";

interface ProductFormProps {
  categories: Category[];
  product?: Product & { id: string };
}

/** Admin create/edit form. POSTs to /api/products or PATCHes /api/products/[id]. */
export function ProductForm({ categories, product }: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    slug: product?.slug ?? "",
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    categorySlug: product?.category ?? categories[0]?.slug ?? "",
    subcategory: product?.subcategory ?? "",
    shortDescription: product?.shortDescription ?? "",
    description: product?.description ?? "",
    price: product?.price?.toString() ?? "",
    compareAtPrice: product?.compareAtPrice?.toString() ?? "",
    currency: product?.currency ?? "USD",
    priceUnit: product?.priceUnit ?? "",
    images: product?.images ?? [],
    tags: product?.tags?.join(", ") ?? "",
    purchasingMode: product?.purchasingMode ?? "buy_online",
    availability: product?.availability ?? "in_stock",
    featured: product?.featured ?? false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const payload = {
      slug: form.slug,
      sku: form.sku || undefined,
      name: form.name,
      categorySlug: form.categorySlug,
      subcategory: form.subcategory || undefined,
      shortDescription: form.shortDescription,
      description: form.description,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
      currency: form.currency,
      priceUnit: form.priceUnit || undefined,
      images: form.images,
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      purchasingMode: form.purchasingMode,
      availability: form.availability,
      featured: form.featured,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/products/${product!.id}` : "/api/products",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed.");
      }

      toast.success(isEdit ? "Product updated." : "Product created.");
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {error && (
        <p
          id="form-error"
          role="alert"
          aria-live="assertive"
          className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "form-error" : undefined}
            className="mt-1.5"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "form-error" : undefined}
            className="mt-1.5"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="categorySlug">Category *</Label>
          <select
            id="categorySlug"
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "form-error" : undefined}
            className="mt-1.5 h-10 w-full border border-border-strong bg-transparent px-3 text-sm"
            value={form.categorySlug}
            onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))}
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="subcategory">Subcategory</Label>
          <Input
            id="subcategory"
            className="mt-1.5"
            value={form.subcategory}
            onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="sku">SKU</Label>
        <Input
          id="sku"
          className="mt-1.5"
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="shortDescription">Short Description *</Label>
        <Textarea
          id="shortDescription"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "form-error" : undefined}
          className="mt-1.5"
          value={form.shortDescription}
          onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          required
          rows={5}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "form-error" : undefined}
          className="mt-1.5"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="price">Price *</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "form-error" : undefined}
            className="mt-1.5"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="compareAtPrice">Compare-at Price</Label>
          <Input
            id="compareAtPrice"
            type="number"
            step="0.01"
            min="0"
            className="mt-1.5"
            value={form.compareAtPrice}
            onChange={(e) => setForm((f) => ({ ...f, compareAtPrice: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            maxLength={3}
            className="mt-1.5 uppercase"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="priceUnit">Price Unit (e.g. sqm)</Label>
        <Input
          id="priceUnit"
          className="mt-1.5"
          value={form.priceUnit}
          onChange={(e) => setForm((f) => ({ ...f, priceUnit: e.target.value }))}
        />
      </div>

      <ImageGalleryUploadField
        id="images"
        label="Product Images"
        required
        hint="First image is used as the main thumbnail. Recommended square, ~1200×1200px."
        values={form.images}
        onChange={(urls) => setForm((f) => ({ ...f, images: urls }))}
      />

      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          className="mt-1.5"
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="purchasingMode">Purchasing Mode</Label>
          <select
            id="purchasingMode"
            className="mt-1.5 h-10 w-full border border-border-strong bg-transparent px-3 text-sm"
            value={form.purchasingMode}
            onChange={(e) =>
              setForm((f) => ({ ...f, purchasingMode: e.target.value as typeof f.purchasingMode }))
            }
          >
            <option value="buy_online">Buy Online</option>
            <option value="quote_only">Quote Only</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <Label htmlFor="availability">Availability</Label>
          <select
            id="availability"
            className="mt-1.5 h-10 w-full border border-border-strong bg-transparent px-3 text-sm"
            value={form.availability}
            onChange={(e) =>
              setForm((f) => ({ ...f, availability: e.target.value as typeof f.availability }))
            }
          >
            <option value="in_stock">In Stock</option>
            <option value="limited">Limited Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="made_to_order">Made to Order</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.featured}
          onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        Featured
      </label>

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}
      </Button>
    </form>
  );
}
