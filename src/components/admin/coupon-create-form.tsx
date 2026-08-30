"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY_FORM = {
  code: "",
  type: "FIXED" as "FIXED" | "PERCENTAGE",
  value: "",
  minOrderAmount: "",
  maxDiscountAmount: "",
  usageLimit: "",
  perCustomerLimit: "",
  endsAt: "",
};

/** Inline create form — a whole separate /admin/coupons/new route would be
 * disproportionate for a form this small (7 optional fields, no images/rich content),
 * unlike products/categories which genuinely warrant their own page. */
export function CouponCreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          type: form.type,
          value: Number(form.value),
          minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
          maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
          perCustomerLimit: form.perCustomerLimit ? Number(form.perCustomerLimit) : null,
          endsAt: form.endsAt || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create coupon.");
      }
      toast.success("Coupon created.");
      setForm(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create coupon.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        New Coupon
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 grid gap-4 border border-border bg-surface p-4 sm:grid-cols-3"
    >
      <div>
        <Label htmlFor="coupon-new-code">Code *</Label>
        <Input
          id="coupon-new-code"
          required
          value={form.code}
          onChange={(e) => set("code", e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="coupon-new-type">Type *</Label>
        <select
          id="coupon-new-type"
          value={form.type}
          onChange={(e) => set("type", e.target.value as "FIXED" | "PERCENTAGE")}
          className="mt-1.5 h-9 w-full border border-border-strong bg-background px-3 text-sm"
        >
          <option value="FIXED">Fixed amount</option>
          <option value="PERCENTAGE">Percentage</option>
        </select>
      </div>
      <div>
        <Label htmlFor="coupon-new-value">
          Value * {form.type === "PERCENTAGE" ? "(%)" : ""}
        </Label>
        <Input
          id="coupon-new-value"
          type="number"
          min="0"
          max={form.type === "PERCENTAGE" ? "100" : undefined}
          step="0.01"
          required
          value={form.value}
          onChange={(e) => set("value", e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="coupon-new-min">Min Order Amount</Label>
        <Input
          id="coupon-new-min"
          type="number"
          min="0"
          step="0.01"
          value={form.minOrderAmount}
          onChange={(e) => set("minOrderAmount", e.target.value)}
          className="mt-1.5"
        />
      </div>
      {form.type === "PERCENTAGE" && (
        <div>
          <Label htmlFor="coupon-new-max">Max Discount Amount</Label>
          <Input
            id="coupon-new-max"
            type="number"
            min="0"
            step="0.01"
            value={form.maxDiscountAmount}
            onChange={(e) => set("maxDiscountAmount", e.target.value)}
            className="mt-1.5"
          />
        </div>
      )}
      <div>
        <Label htmlFor="coupon-new-usage-limit">Total Usage Limit</Label>
        <Input
          id="coupon-new-usage-limit"
          type="number"
          min="1"
          step="1"
          value={form.usageLimit}
          onChange={(e) => set("usageLimit", e.target.value)}
          className="mt-1.5"
          placeholder="Unlimited"
        />
      </div>
      <div>
        <Label htmlFor="coupon-new-per-customer">Per-Customer Limit</Label>
        <Input
          id="coupon-new-per-customer"
          type="number"
          min="1"
          step="1"
          value={form.perCustomerLimit}
          onChange={(e) => set("perCustomerLimit", e.target.value)}
          className="mt-1.5"
          placeholder="Unlimited"
        />
      </div>
      <div>
        <Label htmlFor="coupon-new-ends">Expires</Label>
        <Input
          id="coupon-new-ends"
          type="date"
          value={form.endsAt}
          onChange={(e) => set("endsAt", e.target.value)}
          className="mt-1.5"
          placeholder="Never"
        />
      </div>
      <div className="flex items-end gap-2 sm:col-span-3">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Creating…" : "Create Coupon"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
