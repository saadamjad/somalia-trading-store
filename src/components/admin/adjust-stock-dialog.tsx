"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REASONS = [
  { value: "MANUAL_ADJUSTMENT", label: "Manual adjustment" },
  { value: "RESTOCK", label: "Restock" },
  { value: "CORRECTION", label: "Correction" },
] as const;

interface AdjustStockDialogProps {
  productId: string;
  productName: string;
  currentQuantity: number;
}

/**
 * Inline adjust-stock control (no modal library dependency — just a toggled form row).
 * PATCHes /api/inventory with a signed delta; the server re-validates against the
 * current DB row inside a transaction, so this never trusts the quantity shown here as
 * ground truth (see src/server/services/inventory-service.ts).
 */
export function AdjustStockDialog({
  productId,
  productName,
  currentQuantity,
}: AdjustStockDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("MANUAL_ADJUSTMENT");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const deltaValue = Number(delta);
    if (!Number.isInteger(deltaValue) || deltaValue === 0) {
      setError("Enter a non-zero whole number (positive to add stock, negative to remove).");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          delta: deltaValue,
          reason,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Stock adjustment failed.");
      }

      toast.success(`Stock updated for ${productName}.`);
      setIsOpen(false);
      setDelta("");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stock adjustment failed.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Adjust
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface p-3"
    >
      <p className="text-xs text-muted">
        Currently {currentQuantity} on hand. Enter a positive number to add stock, negative
        to remove.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <Label htmlFor={`delta-${productId}`} className="text-xs">
            Delta
          </Label>
          <Input
            id={`delta-${productId}`}
            type="number"
            step={1}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="e.g. 10 or -5"
            required
          />
        </div>
        <div className="w-44">
          <Label htmlFor={`reason-${productId}`} className="text-xs">
            Reason
          </Label>
          <select
            id={`reason-${productId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            className="h-9 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[10rem] flex-1">
          <Label htmlFor={`note-${productId}`} className="text-xs">
            Note (optional)
          </Label>
          <Input
            id={`note-${productId}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason detail"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
