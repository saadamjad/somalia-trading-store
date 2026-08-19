"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CMSPageView } from "@/server/services/cms-page-service";
import type { CMSBlock } from "@/lib/validations/cms";

interface CMSPageFormProps {
  page?: CMSPageView;
}

function emptyBlock(type: CMSBlock["type"]): CMSBlock {
  switch (type) {
    case "heading":
      return { type: "heading", text: "" };
    case "paragraph":
      return { type: "paragraph", text: "" };
    case "faqItem":
      return { type: "faqItem", question: "", answer: "" };
  }
}

/**
 * Admin create/edit form for a CMSPage. Deliberately a handful of typed fields per
 * block, not a WYSIWYG/rich-text editor — matches the "structured JSON blocks, not raw
 * HTML" design (see CMSPage's schema comment) and the Phase 12 plan's explicit
 * instruction not to add a heavy rich-text-editor dependency for this.
 */
export function CMSPageForm({ page }: CMSPageFormProps) {
  const router = useRouter();
  const isEdit = Boolean(page);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState(page?.slug ?? "");
  const [title, setTitle] = useState(page?.title ?? "");
  const [published, setPublished] = useState(page?.published ?? false);
  const [blocks, setBlocks] = useState<CMSBlock[]>(
    (page?.body as CMSBlock[] | undefined) ?? []
  );

  function updateBlock(index: number, next: CMSBlock) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? next : b)));
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function addBlock(type: CMSBlock["type"]) {
    setBlocks((prev) => [...prev, emptyBlock(type)]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const payload = { slug, title, published, body: blocks };

      const res = await fetch(
        isEdit ? `/api/admin/cms/pages/${page!.id}` : "/api/admin/cms/pages",
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

      toast.success(isEdit ? "Page updated." : "Page created.");
      router.push("/admin/cms");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
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
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            required
            className="mt-1.5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            required
            placeholder="faq"
            className="mt-1.5"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <Label>Content Blocks</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addBlock("heading")}>
              <Plus className="h-4 w-4" /> Heading
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addBlock("paragraph")}>
              <Plus className="h-4 w-4" /> Paragraph
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => addBlock("faqItem")}>
              <Plus className="h-4 w-4" /> FAQ Item
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div key={index} className="border border-border p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="label text-accent">{block.type}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeBlock(index)}
                  aria-label="Remove block"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {block.type === "heading" && (
                <Input
                  placeholder="Heading text"
                  value={block.text}
                  onChange={(e) => updateBlock(index, { type: "heading", text: e.target.value })}
                />
              )}

              {block.type === "paragraph" && (
                <Textarea
                  rows={3}
                  placeholder="Paragraph text"
                  value={block.text}
                  onChange={(e) => updateBlock(index, { type: "paragraph", text: e.target.value })}
                />
              )}

              {block.type === "faqItem" && (
                <div className="space-y-3">
                  <Input
                    placeholder="Question"
                    value={block.question}
                    onChange={(e) =>
                      updateBlock(index, { ...block, type: "faqItem", question: e.target.value })
                    }
                  />
                  <Textarea
                    rows={3}
                    placeholder="Answer"
                    value={block.answer}
                    onChange={(e) =>
                      updateBlock(index, { ...block, type: "faqItem", answer: e.target.value })
                    }
                  />
                </div>
              )}
            </div>
          ))}
          {blocks.length === 0 && (
            <p className="border border-dashed border-border p-6 text-center text-sm text-muted">
              No content blocks yet — add one above.
            </p>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-accent"
        />
        Published
      </label>

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Create Page"}
      </Button>
    </form>
  );
}
