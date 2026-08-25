"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
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

/** Multi-image gallery field for products: upload one or more files, reorder by re-uploading, remove individually. */
export function ImageGalleryUploadField({
  id,
  label,
  values,
  onChange,
  required,
  hint,
}: ImageGalleryUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
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

  return (
    <div>
      <Label htmlFor={id}>
        {label} {required && "*"}
      </Label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}

      <div className="mt-1.5 flex flex-wrap gap-3">
        {values.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border"
          >
            <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label={`Remove image ${i + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        <label
          htmlFor={id}
          className={cn(
            "flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent",
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
