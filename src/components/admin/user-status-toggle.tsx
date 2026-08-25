"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

interface UserStatusToggleProps {
  userId: string;
  name: string;
  active: boolean;
}

/**
 * Admin User Management & RBAC — activate/deactivate control for the admin users
 * list. A dedicated component rather than reusing DeleteButton: the semantics differ
 * (a reversible toggle, not a one-way destructive delete), so the confirm copy and
 * button labels differ too. Same AlertDialog primitives and isWorking/toast/refresh
 * pattern as DeleteButton.
 */
export function UserStatusToggle({ userId, name, active }: UserStatusToggleProps) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);
  const [open, setOpen] = useState(false);

  const nextActive = !active;

  const handleConfirm = async () => {
    setIsWorking(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not update this account.");
      }
      toast.success(nextActive ? `${name} reactivated.` : `${name} deactivated.`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this account.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !isWorking && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {active ? "Deactivate" : "Reactivate"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onEscapeKeyDown={(e) => isWorking && e.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{active ? `Deactivate ${name}?` : `Reactivate ${name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {active
              ? `${name} will immediately lose access to the admin panel. You can reactivate them at any time.`
              : `${name} will regain access to the admin panel with their existing password.`}
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
            {isWorking ? "Working…" : active ? "Deactivate" : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
