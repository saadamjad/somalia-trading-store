"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ResetPasswordButtonProps {
  userId: string;
  name: string;
}

/**
 * Admin User Management & RBAC — "Reset Password" action on the edit-admin screen.
 * Two-step: a confirm dialog, then (on confirm) the new temp password shown once in
 * the same must-acknowledge pattern as account creation.
 */
export function ResetPasswordButton({ userId, name }: ResetPasswordButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsWorking(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not reset this password.");
      }
      const data = await res.json();
      setConfirmOpen(false);
      setTempPassword(data.tempPassword);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset this password.");
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Could not copy — please copy it manually.");
    }
  };

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={(next) => !isWorking && setConfirmOpen(next)}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="outline">
            Reset Password
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onEscapeKeyDown={(e) => isWorking && e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {name}&apos;s password?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate their current password and they&apos;ll need to set
              a new one on next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={isWorking}
            >
              {isWorking ? "Working…" : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(tempPassword)}>
        <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Password reset</AlertDialogTitle>
            <AlertDialogDescription>
              New temporary password (shown once) — share this with {name} directly.
              It will not be shown again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-5">
            <div className="flex items-center gap-2 border border-border-strong bg-surface px-4 py-3">
              <code className="flex-1 font-mono text-sm">{tempPassword}</code>
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                Copy
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTempPassword(null)}>
              I&apos;ve saved it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
