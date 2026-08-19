"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const REASON_OPTIONS = [
  { value: "DAMAGED", label: "Item arrived damaged" },
  { value: "WRONG_ITEM", label: "Wrong item received" },
  { value: "NOT_AS_DESCRIBED", label: "Not as described" },
  { value: "NO_LONGER_NEEDED", label: "No longer needed" },
  { value: "OTHER", label: "Other" },
] as const;

interface RequestRefundFormProps {
  orderId: string;
}

/**
 * Customer-facing "Request Refund" form on /account/orders/[id]. Submits to
 * POST /api/refund-requests, which re-verifies order ownership and eligibility
 * server-side (this form's rendering condition — order eligible, no open request — is
 * UX convenience only, never the enforcement point). Deliberately has no amount/price
 * field: this creates a REQUEST, not a financial transaction (docs/DECISIONS.md D-007).
 */
export function RequestRefundForm({ orderId }: RequestRefundFormProps) {
  const router = useRouter();
  const [reasonCategory, setReasonCategory] = useState<string>(REASON_OPTIONS[0].value);
  const [reasonDetail, setReasonDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/refund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reasonCategory,
          reasonDetail: reasonDetail.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Requesting a refund failed.");
      }

      toast.success("Refund request submitted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Requesting a refund failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="reason-category" className="text-xs">
          Reason
        </Label>
        <select
          id="reason-category"
          value={reasonCategory}
          onChange={(e) => setReasonCategory(e.target.value)}
          className="h-9 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
        >
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="reason-detail" className="text-xs">
          Additional details (optional)
        </Label>
        <Textarea
          id="reason-detail"
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          placeholder="Tell us more about the issue…"
          className="min-h-[80px]"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Request Refund"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </form>
  );
}
