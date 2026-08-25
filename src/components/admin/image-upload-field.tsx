"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UploadContext = "product" | "category" | "banner";

interface ImageUploadFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  context: UploadContext;
  hint?: string;
  required?: boolean;
}

/**
 * Single-image field: shows a preview of the current URL, a file picker that
 * uploads to Vercel Blob via /api/admin/upload, and falls back to a plain text
 * input so an admin can still paste an external URL directly if they want to.
 */
export function ImageUploadField({
  id,
  label,
  value,
  onChange,
  context,
  hint,
  required,
}: ImageUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch(`/api/admin/upload?context=${context}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      onChange(data.url);
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <Label htmlFor={id}>
        {label} {required && "*"}
      </Label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}

      <div className="mt-1.5 flex items-start gap-3">
        {value ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
            <Image src={value} alt="" fill sizes="80px" className="object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted">
            <Upload className="h-5 w-5" />
          </div>
        )}

        <div className="flex-1 space-y-2">
          <Input
            id={id}
            required={required}
            placeholder="/images/... or https://..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={isUploading}
              className={cn(
                "text-sm text-muted file:mr-3 file:border-0 file:bg-accent-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent-light",
                isUploading && "opacity-60"
              )}
            />
            {isUploading && (
              <p className="mt-1 text-xs text-muted">Uploading…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
