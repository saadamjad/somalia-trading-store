"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ImageGalleryUploadFieldProps {
  id: string;
  label: string;
  values: string[];
  onChange: (urls: string[]) => void;
  required?: boolean;
  hint?: string;
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Multi-image gallery field for products: upload one or more files, reorder by
 * drag-and-drop or the move-left/move-right buttons (the buttons are the reliable
 * path on touch devices, where native HTML5 drag-and-drop is unreliable — kept as the
 * primary control, drag as a bonus for desktop admins), remove individually, and
 * promote any image to primary (index 0 — the product's main/thumbnail image by
 * convention; see product-form.tsx and the public product page).
 */
export function ImageGalleryUploadField({
  id,
  label,
  values,
  onChange,
  required,
  hint,
}: ImageGalleryUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file);
        const res = await fetch("/api/admin/upload?context=product", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}.`);
        }
        uploaded.push(data.url);
      }
      onChange([...values, ...uploaded]);
      toast.success(uploaded.length > 1 ? "Images uploaded." : "Image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= values.length) return;
    onChange(moveItem(values, from, to));
  };

  const setPrimary = (index: number) => {
    if (index === 0) return;
    onChange(moveItem(values, index, 0));
  };

  return (
    <div data-testid={`image-gallery-${id}`}>
      <Label htmlFor={id}>
        {label} {required && "*"}
      </Label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {values.length > 1 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Drag to reorder, or use the arrows. The first image is the product&apos;s primary photo.
        </p>
      )}

      <div className="mt-1.5 flex flex-wrap gap-3">
        {values.map((url, i) => (
          <div
            key={`${url}-${i}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== i) onChange(moveItem(values, dragIndex, i));
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={cn(
              "relative h-24 w-24 shrink-0 cursor-grab overflow-hidden rounded-lg border active:cursor-grabbing",
              i === 0 ? "border-accent" : "border-border",
              dragIndex === i && "opacity-50"
            )}
          >
            <Image src={url} alt="" fill sizes="96px" className="object-cover" />

            {i === 0 ? (
              <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                <Star className="h-2.5 w-2.5 fill-current" />
                Primary
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPrimary(i)}
                className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black/80"
              >
                Set primary
              </button>
            )}

            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label={`Remove image ${i + 1}`}
            >
              <X className="h-3 w-3" />
            </button>

            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 bg-black/50 py-0.5">
              <button
                type="button"
                onClick={() => moveTo(i, i - 1)}
                disabled={i === 0}
                aria-label={`Move image ${i + 1} earlier`}
                className="flex h-5 w-5 items-center justify-center text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveTo(i, i + 1)}
                disabled={i === values.length - 1}
                aria-label={`Move image ${i + 1} later`}
                className="flex h-5 w-5 items-center justify-center text-white disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}

        <label
          htmlFor={id}
          className={cn(
            "flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent",
            isUploading && "pointer-events-none opacity-60"
          )}
        >
          <Upload className="h-5 w-5" />
          <span className="text-[10px]">{isUploading ? "Uploading…" : "Add"}</span>
        </label>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFilesSelect}
          disabled={isUploading}
          className="sr-only"
        />
      </div>
      {required && values.length === 0 && (
        <p className="mt-1.5 text-xs text-muted">At least one image is required.</p>
      )}
    </div>
  );
}
