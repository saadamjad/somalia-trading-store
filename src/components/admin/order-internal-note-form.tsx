"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface OrderInternalNoteFormProps {
  orderId: string;
  initialNote: string | null;
}

/**
 * Admin-only working note (`Order.internalNote`) — never rendered anywhere in
 * `/account/orders`. A single overwritable field (see the schema comment on
 * `internalNote`), so saving replaces the previous value rather than appending to a log.
 */
export function OrderInternalNoteForm({ orderId, initialNote }: OrderInternalNoteFormProps) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNote: note.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Saving the note failed.");
      }

      toast.success("Internal note saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving the note failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Internal note — visible only to admins, never shown to the customer."
        className="min-h-[80px]"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save note"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </form>
  );
}
