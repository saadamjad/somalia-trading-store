"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface DeleteButtonProps {
  url: string;
  confirmMessage?: string;
  label?: string;
}

export function DeleteButton({ url, confirmMessage = "Delete this item?", label }: DeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(confirmMessage)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed.");
      }
      toast.success("Deleted.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleDelete}
      disabled={isDeleting}
      aria-label={label ?? "Delete"}
    >
      <Trash2 className="h-4 w-4" />
      {isDeleting ? "Deleting…" : "Delete"}
    </Button>
  );
}
