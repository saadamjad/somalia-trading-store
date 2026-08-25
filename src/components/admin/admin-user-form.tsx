"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PERMISSION_GROUPS, roleLabel } from "@/config/permission-labels";

interface RoleOption {
  id: string;
  name: string;
}

interface ExistingUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  roleId: string;
}

interface AdminUserFormProps {
  roles: RoleOption[];
  /** Every permission key each role currently grants — for the "this role grants…" summary. */
  rolePermissions: Record<string, readonly string[]>;
  existingUser?: ExistingUser;
  /** Set only when editing self — disables the role field with an explanatory note. */
  isEditingSelf?: boolean;
}

/**
 * Admin User Management & RBAC — shared create/edit form, mirroring category-form.tsx's
 * exact create-vs-edit pattern (one component, an `existingUser` prop switches mode).
 * Password is only collected on create (auto-generated if left blank); editing never
 * touches the password field — that's the separate "Reset Password" flow.
 */
export function AdminUserForm({
  roles,
  rolePermissions,
  existingUser,
  isEditingSelf,
}: AdminUserFormProps) {
  const router = useRouter();
  const isEdit = Boolean(existingUser);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: existingUser?.name ?? "",
    email: existingUser?.email ?? "",
    phone: existingUser?.phone ?? "",
    roleId: existingUser?.roleId ?? roles.find((r) => r.name === "staff")?.id ?? roles[0]?.id ?? "",
    password: "",
  });

  const selectedRole = roles.find((r) => r.id === form.roleId);
  const grantedKeys = useMemo(
    () => new Set(selectedRole ? rolePermissions[selectedRole.name] ?? [] : []),
    [selectedRole, rolePermissions]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/users/${existingUser!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone || null,
            ...(isEditingSelf ? {} : { roleId: form.roleId }),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Save failed.");
        }
        toast.success("Admin account updated.");
        router.push("/admin/users");
        router.refresh();
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone || undefined,
            roleId: form.roleId,
            password: form.password || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Save failed.");
        }
        const data = await res.json();
        setTempPassword(data.tempPassword);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAcknowledgeTempPassword = () => {
    setTempPassword(null);
    router.push("/admin/users");
    router.refresh();
  };

  const handleCopyTempPassword = async () => {
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
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "form-error" : undefined}
              className="mt-1.5"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              required
              disabled={isEdit}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "form-error" : undefined}
              className="mt-1.5"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            className="mt-1.5"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="roleId">Role *</Label>
          <select
            id="roleId"
            required
            disabled={isEditingSelf}
            className="mt-1.5 h-10 w-full border border-border-strong bg-transparent px-3 text-sm disabled:opacity-50"
            value={form.roleId}
            onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {roleLabel(role.name)}
              </option>
            ))}
          </select>
          {isEditingSelf && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              You cannot change your own role.
            </p>
          )}
        </div>

        {!isEdit && (
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="text"
              placeholder="Leave blank to auto-generate"
              className="mt-1.5"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
        )}

        <div className="border border-border bg-surface p-4 text-sm">
          <p className="mb-2 font-medium">This role grants:</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {PERMISSION_GROUPS.map((group) => {
              const groupGranted = group.permissions.filter((p) => grantedKeys.has(p.key));
              if (groupGranted.length === 0) return null;
              return (
                <p key={group.label} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{group.label}:</span>{" "}
                  {groupGranted.map((p) => p.label.replace(/^(View|Create|Update|Delete|Manage) /, "")).join(", ")}
                </p>
              );
            })}
          </div>
          {PERMISSION_GROUPS.every(
            (group) => group.permissions.filter((p) => grantedKeys.has(p.key)).length === 0
          ) && <p className="text-muted-foreground">No permissions.</p>}
        </div>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : isEdit ? "Save Changes" : "Create Admin"}
        </Button>
      </form>

      <AlertDialog open={Boolean(tempPassword)}>
        <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Admin account created</AlertDialogTitle>
            <AlertDialogDescription>
              Temporary password (shown once) — share this with {form.name} directly.
              It will not be shown again. They&apos;ll be required to set their own
              password on first login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-5">
            <div className="flex items-center gap-2 border border-border-strong bg-surface px-4 py-3">
              <code className="flex-1 font-mono text-sm">{tempPassword}</code>
              <Button type="button" variant="outline" size="sm" onClick={handleCopyTempPassword}>
                Copy
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleAcknowledgeTempPassword}>
              I&apos;ve saved it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
