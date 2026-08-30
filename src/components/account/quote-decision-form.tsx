"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface QuoteDecisionFormProps {
  quoteId: string;
}

/**
 * Customer's own accept/decline of a QUOTED quote — PATCHes /api/quotes/[id]
 * (ownership-checked server-side). Accepting does NOT create an order by itself; a
 * human admin still converts it via /admin/quotes (see quote-service.ts
 * `convertToOrder`'s comment for why conversion is deliberately admin-triggered).
 */
export function QuoteDecisionForm({ quoteId }: QuoteDecisionFormProps) {
  const t = useTranslations("account");
  const router = useRouter();
  const [isSaving, setIsSaving] = useState<"ACCEPTED" | "DECLINED" | null>(null);

  async function decide(status: "ACCEPTED" | "DECLINED") {
    setIsSaving(status);
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("quotes.decisionError"));
      }
      toast.success(status === "ACCEPTED" ? t("quotes.acceptSuccess") : t("quotes.declineSuccess"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("quotes.decisionError"));
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={isSaving !== null} onClick={() => decide("ACCEPTED")}>
        {isSaving === "ACCEPTED" ? t("quotes.accepting") : t("quotes.acceptQuote")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isSaving !== null}
        onClick={() => decide("DECLINED")}
      >
        {isSaving === "DECLINED" ? t("quotes.declining") : t("quotes.decline")}
      </Button>
    </div>
  );
}
