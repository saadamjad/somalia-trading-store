"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
        throw new Error(data.error || "Updating your quote failed.");
      }
      toast.success(status === "ACCEPTED" ? "Quote accepted." : "Quote declined.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Updating your quote failed.");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={isSaving !== null} onClick={() => decide("ACCEPTED")}>
        {isSaving === "ACCEPTED" ? "Accepting…" : "Accept Quote"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isSaving !== null}
        onClick={() => decide("DECLINED")}
      >
        {isSaving === "DECLINED" ? "Declining…" : "Decline"}
      </Button>
    </div>
  );
}
