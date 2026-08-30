"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ReviewModerationActionsProps {
  reviewId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

/**
 * Small, isolated client component for the one interactive bit of an otherwise
 * server-rendered admin page — same pattern as other admin action buttons in this
 * codebase (don't make the whole page a Client Component for one control).
 */
export function ReviewModerationActions({ reviewId, status }: ReviewModerationActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function moderate(next: "APPROVED" | "REJECTED") {
    setPendingAction(next);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update review.");
      }
      toast.success(next === "APPROVED" ? "Review approved." : "Review rejected.");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update review.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending || pendingAction !== null || status === "APPROVED"}
        onClick={() => moderate("APPROVED")}
      >
        {pendingAction === "APPROVED" ? "Approving…" : "Approve"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending || pendingAction !== null || status === "REJECTED"}
        onClick={() => moderate("REJECTED")}
      >
        {pendingAction === "REJECTED" ? "Rejecting…" : "Reject"}
      </Button>
    </div>
  );
}
