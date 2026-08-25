"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import type { BannerView } from "@/server/services/banner-service";
import type { BannerSlot } from "@/generated/prisma/client";

interface BannerFormProps {
  banner?: BannerView;
}

/** Converts an ISO datetime string to the value a `datetime-local` input expects. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

/** Admin create/edit form. POSTs to /api/admin/cms/banners or PATCHes /api/admin/cms/banners/[id]. */
export function BannerForm({ banner }: BannerFormProps) {
  const router = useRouter();
  const isEdit = Boolean(banner);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    slot: banner?.slot ?? "HOMEPAGE_HERO",
    title: banner?.title ?? "",
    subtitle: banner?.subtitle ?? "",
    imageUrl: banner?.imageUrl ?? "",
    linkUrl: banner?.linkUrl ?? "",
    ctaText: banner?.ctaText ?? "",
    active: banner?.active ?? false,
    priority: banner?.priority ?? 0,
    startsAt: toLocalInputValue(banner?.startsAt ?? null),
    endsAt: toLocalInputValue(banner?.endsAt ?? null),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const payload = {
        slot: form.slot,
        title: form.title,
        subtitle: form.subtitle || null,
        imageUrl: form.imageUrl || null,
        linkUrl: form.linkUrl || null,
        ctaText: form.ctaText || null,
        active: form.active,
        priority: Number(form.priority),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      };

      const res = await fetch(
        isEdit ? `/api/admin/cms/banners/${banner!.id}` : "/api/admin/cms/banners",
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

      toast.success(isEdit ? "Banner updated." : "Banner created.");
      router.push("/admin/cms");
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

      <div>
        <Label htmlFor="slot">Slot *</Label>
        <select
          id="slot"
          required
          className="mt-1.5 h-10 w-full border border-border-strong bg-transparent px-3 text-sm"
          value={form.slot}
          onChange={(e) => setForm((f) => ({ ...f, slot: e.target.value as BannerSlot }))}
        >
          <option value="HOMEPAGE_HERO">Homepage Hero</option>
          <option value="HOMEPAGE_PROMO">Homepage Promo Strip</option>
        </select>
      </div>

      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          required
          className="mt-1.5"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </div>

      <div>
        <Label htmlFor="subtitle">Subtitle</Label>
        <Textarea
          id="subtitle"
          className="mt-1.5"
          value={form.subtitle}
          onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploadField
          id="imageUrl"
          label="Image"
          context="banner"
          hint="Wide banner image. Recommended ~1920×800px."
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
        />
        <div>
          <Label htmlFor="linkUrl">Link URL</Label>
          <Input
            id="linkUrl"
            placeholder="/shop or https://..."
            className="mt-1.5"
            value={form.linkUrl}
            onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ctaText">CTA Text</Label>
          <Input
            id="ctaText"
            className="mt-1.5"
            value={form.ctaText}
            onChange={(e) => setForm((f) => ({ ...f, ctaText: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            type="number"
            min={0}
            className="mt-1.5"
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startsAt">Starts At (optional)</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            className="mt-1.5"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="endsAt">Ends At (optional)</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            className="mt-1.5"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        Active
      </label>

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Create Banner"}
      </Button>
    </form>
  );
}
