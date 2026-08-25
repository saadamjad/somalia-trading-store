"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import type { Category } from "@/lib/types/product";

interface CategoryFormProps {
  category?: Category;
}

/** Admin create/edit form. POSTs to /api/categories or PATCHes /api/categories/[id]. */
export function CategoryForm({ category }: CategoryFormProps) {
  const router = useRouter();
  const isEdit = Boolean(category);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    slug: category?.slug ?? "",
    name: category?.name ?? "",
    shortDescription: category?.shortDescription ?? "",
    description: category?.description ?? "",
    image: category?.image ?? "",
    heroImage: category?.heroImage ?? "",
    accentColor: category?.accentColor ?? "#8B7355",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch(
        isEdit ? `/api/categories/${category!.id}` : "/api/categories",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed.");
      }

      toast.success(isEdit ? "Category updated." : "Category created.");
      router.push("/admin/categories");
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
          role="alert"
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
            className="mt-1.5"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="shortDescription">Short Description *</Label>
        <Textarea
          id="shortDescription"
          required
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
          className="mt-1.5"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploadField
          id="image"
          label="Image"
          required
          context="category"
          hint="Square-ish, shown on category cards. Recommended ~800×800px."
          value={form.image}
          onChange={(url) => setForm((f) => ({ ...f, image: url }))}
        />
        <ImageUploadField
          id="heroImage"
          label="Hero Image"
          required
          context="category"
          hint="Wide banner, shown at the top of the category page. Recommended ~1600×600px."
          value={form.heroImage}
          onChange={(url) => setForm((f) => ({ ...f, heroImage: url }))}
        />
      </div>

      <div>
        <Label htmlFor="accentColor">Accent Color *</Label>
        <Input
          id="accentColor"
          required
          className="mt-1.5"
          value={form.accentColor}
          onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
        />
      </div>

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Create Category"}
      </Button>
    </form>
  );
}
