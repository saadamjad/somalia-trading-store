"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Mirrors `ALLOWED_STATUS_TRANSITIONS` in src/server/services/order-service.ts — kept
 * here only to drive which options this dropdown shows, NOT as the enforcement point.
 * The server re-validates every transition independently (PATCH /api/admin/orders/[id])
 * and is the only place that actually matters; a stale/bypassed client can't produce an
 * invalid transition, it can only get a 400 back from the server.
 */
const ALLOWED_NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

interface OrderStatusUpdateFormProps {
  orderId: string;
  currentStatus: string;
}

export function OrderStatusUpdateForm({ orderId, currentStatus }: OrderStatusUpdateFormProps) {
  const router = useRouter();
  const nextOptions = ALLOWED_NEXT_STATUSES[currentStatus] ?? [];
  const [status, setStatus] = useState(nextOptions[0] ?? "");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nextOptions.length === 0) {
    return (
      <p className="text-sm text-muted">
        {currentStatus} is a final status — no further transitions are available.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!status) {
      setError("Choose a status to move to.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Status update failed.");
      }

      toast.success(`Order moved to ${status}.`);
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Label htmlFor="next-status" className="text-xs">
            Move to
          </Label>
          <select
            id="next-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
          >
            {nextOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor="status-note" className="text-xs">
            Note (optional)
          </Label>
          <Input
            id="status-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason / context for this change"
          />
        </div>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Updating…" : "Update status"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
