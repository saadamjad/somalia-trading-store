"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Mirrors `ALLOWED_REFUND_STATUS_TRANSITIONS` in refund-request-service.ts — drives
 * which options this dropdown shows only; the server re-validates independently
 * (PATCH /api/admin/refund-requests/[id]) and is the only enforcement point.
 */
const ALLOWED_NEXT_STATUSES: Record<string, string[]> = {
  REQUESTED: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

interface RefundRequestReviewFormProps {
  refundRequestId: string;
  currentStatus: string;
  initialAdminNote: string | null;
}

/**
 * Admin approve/reject/under-review action. `adminNote` is customer-visible (see the
 * schema comment on RefundRequest.adminNote) — write something the customer can read,
 * e.g. explaining why a request was rejected. This action NEVER touches
 * `Order.paymentStatus` — approving a refund request is a business decision that we
 * agree the customer should be refunded, not a record that money actually moved
 * (docs/DECISIONS.md D-007, Phase 10 hard requirement).
 */
export function RefundRequestReviewForm({
  refundRequestId,
  currentStatus,
  initialAdminNote,
}: RefundRequestReviewFormProps) {
  const router = useRouter();
  const nextOptions = ALLOWED_NEXT_STATUSES[currentStatus] ?? [];
  const [status, setStatus] = useState(nextOptions[0] ?? "");
  const [adminNote, setAdminNote] = useState(initialAdminNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nextOptions.length === 0) {
    return (
      <p className="text-sm text-muted">
        {currentStatus} is a final status — no further action is available.
      </p>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!status) {
      setError("Choose an action.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/refund-requests/${refundRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: adminNote.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Updating the refund request failed.");
      }

      toast.success(`Refund request moved to ${status}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Updating the refund request failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="next-refund-status" className="text-xs">
          Action
        </Label>
        <select
          id="next-refund-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 w-full max-w-xs rounded-md border border-border-strong bg-background px-3 text-sm"
        >
          {nextOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="admin-note" className="text-xs">
          Note to customer (optional)
        </Label>
        <Textarea
          id="admin-note"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Visible to the customer — e.g. explain a rejection."
          className="min-h-[80px]"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving…" : "Submit decision"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </form>
  );
}
