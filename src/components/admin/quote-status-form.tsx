"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/** Mirrors `ALLOWED_QUOTE_STATUS_TRANSITIONS` in quote-service.ts, minus QUOTED (its
 * own dedicated form) and CONVERTED (its own dedicated action). */
const ALLOWED_NEXT_STATUSES: Record<string, ("REVIEWING" | "ACCEPTED" | "DECLINED")[]> = {
  NEW: ["REVIEWING", "DECLINED"],
  REVIEWING: ["DECLINED"],
  QUOTED: ["ACCEPTED", "DECLINED"],
  ACCEPTED: [],
  DECLINED: [],
  CONVERTED: [],
};

interface QuoteStatusFormProps {
  quoteId: string;
  currentStatus: string;
}

/**
 * Admin plain status transitions (REVIEWING / ACCEPTED / DECLINED) — e.g. moving a
 * fresh submission into REVIEWING, marking a customer's verbal acceptance, or
 * declining a request outright. Never QUOTED (see QuoteResponseForm) or CONVERTED (see
 * QuoteConvertForm) — those have their own dedicated actions with their own
 * preconditions.
 */
export function QuoteStatusForm({ quoteId, currentStatus }: QuoteStatusFormProps) {
  const router = useRouter();
  const nextOptions = ALLOWED_NEXT_STATUSES[currentStatus] ?? [];
  const [status, setStatus] = useState(nextOptions[0] ?? "");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (nextOptions.length === 0) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!status) {
      setError("Choose an action.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Updating this quote failed.");
      }

      toast.success(`Quote moved to ${status}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Updating this quote failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="next-quote-status" className="text-xs">
          Action
        </Label>
        <select
          id="next-quote-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "REVIEWING" | "ACCEPTED" | "DECLINED")}
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
        <Label htmlFor="quote-status-note" className="text-xs">
          Note (optional, internal timeline only)
        </Label>
        <Textarea
          id="quote-status-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[60px]"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving…" : "Submit"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </form>
  );
}
