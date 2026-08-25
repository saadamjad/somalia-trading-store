"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Admin User Management & RBAC — forced password-change screen. Reached only when
 * the session's mustChangePassword flag is set (new admin accounts always start with
 * it, until this screen is completed once). Reuses the existing
 * PATCH /api/account/password route/accountService.changePassword as-is — this is
 * the same "verify current password, hash the new one" logic every account already
 * uses, not a parallel system. That repository call also clears mustChangePassword
 * on success (see userRepository.updatePasswordHash), so no extra step is needed here.
 */
export default function AdminChangePasswordPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not change your password.");
      }

      toast.success("Password changed.");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-display mb-2 text-2xl font-bold">Set a New Password</h1>
      <p className="mb-8 text-sm text-muted">
        You&apos;re signing in with a temporary password. Choose a new one to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p
            id="form-error"
            role="alert"
            aria-live="assertive"
            className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <div>
          <Label htmlFor="currentPassword">Temporary Password *</Label>
          <Input
            id="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "form-error" : undefined}
            className="mt-1.5"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="newPassword">New Password *</Label>
          <Input
            id="newPassword"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "form-error" : undefined}
            className="mt-1.5"
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm New Password *</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "form-error" : undefined}
            className="mt-1.5"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          />
        </div>

        <Button type="submit" disabled={isSaving} className="w-full">
          {isSaving ? "Saving…" : "Set New Password"}
        </Button>
      </form>
    </div>
  );
}
