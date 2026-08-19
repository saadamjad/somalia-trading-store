"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  profile: {
    name: string;
    email: string;
    phone: string | null;
  };
}

/**
 * PATCHes /api/account. Email changes require the user to also enter their current
 * password (revealed inline once they edit the email field) — see
 * accountService.updateProfile for the server-side enforcement, which is the real
 * security boundary; this is only a UX nudge.
 */
export function ProfileForm({ profile }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChangingEmail = email.trim().toLowerCase() !== profile.email.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          ...(isChangingEmail ? { currentPassword } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not update your profile.");
      }

      toast.success("Profile updated.");
      setCurrentPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p
          role="alert"
          className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1.5"
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1.5"
        />
      </div>

      {isChangingEmail && (
        <div>
          <Label htmlFor="currentPasswordForEmail">Current Password</Label>
          <p className="mt-1 text-xs text-muted">
            Confirm your current password to change your email address.
          </p>
          <Input
            id="currentPasswordForEmail"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="mt-1.5"
          />
        </div>
      )}

      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1.5"
        />
      </div>

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving…" : "Save Changes"}
      </Button>
    </form>
  );
}
