"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const REASON_VALUES = [
  "DAMAGED",
  "WRONG_ITEM",
  "NOT_AS_DESCRIBED",
  "NO_LONGER_NEEDED",
  "OTHER",
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
  const t = useTranslations("account");
  const router = useRouter();
  const [reasonCategory, setReasonCategory] = useState<string>(REASON_VALUES[0]);
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
        throw new Error(data.error || t("refunds.submitError"));
      }

      toast.success(t("refunds.submitSuccess"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("refunds.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="reason-category" className="text-xs">
          {t("refunds.reasonLabel")}
        </Label>
        <select
          id="reason-category"
          value={reasonCategory}
          onChange={(e) => setReasonCategory(e.target.value)}
          className="h-9 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
        >
          {REASON_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`refunds.reasons.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="reason-detail" className="text-xs">
          {t("refunds.detailLabel")}
        </Label>
        <Textarea
          id="reason-detail"
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          placeholder={t("refunds.detailPlaceholder")}
          className="min-h-[80px]"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? t("refunds.submitting") : t("refunds.submit")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </form>
  );
}
