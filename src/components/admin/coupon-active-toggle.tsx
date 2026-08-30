"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CouponActiveToggleProps {
  couponId: string;
  active: boolean;
}

/** Deactivation is the only "remove" action for a coupon — see the schema comment on
 * CouponRedemption's onDelete: Restrict (a coupon with redemptions can't be
 * hard-deleted, preserving the historical discount record on past orders). */
export function CouponActiveToggle({ couponId, active }: CouponActiveToggleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  async function toggle() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update coupon.");
      }
      toast.success(active ? "Coupon deactivated." : "Coupon activated.");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update coupon.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={isPending || submitting} onClick={toggle}>
      {active ? "Deactivate" : "Activate"}
    </Button>
  );
}
