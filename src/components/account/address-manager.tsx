"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AddressDTO {
  id: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

type AddressFormValues = Omit<AddressDTO, "id" | "isDefault">;

const EMPTY_FORM: AddressFormValues = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

function AddressFields({
  values,
  onChange,
  idPrefix,
}: {
  values: AddressFormValues;
  onChange: (values: AddressFormValues) => void;
  idPrefix: string;
}) {
  const set = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${idPrefix}-recipientName`}>Recipient Name</Label>
        <Input
          id={`${idPrefix}-recipientName`}
          value={values.recipientName}
          onChange={(e) => set("recipientName", e.target.value)}
          required
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          required
          className="mt-1.5"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line1`}>Address Line 1</Label>
        <Input
          id={`${idPrefix}-line1`}
          value={values.line1}
          onChange={(e) => set("line1", e.target.value)}
          required
          className="mt-1.5"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${idPrefix}-line2`}>Address Line 2 (optional)</Label>
        <Input
          id={`${idPrefix}-line2`}
          value={values.line2 ?? ""}
          onChange={(e) => set("line2", e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-city`}>City</Label>
        <Input
          id={`${idPrefix}-city`}
          value={values.city}
          onChange={(e) => set("city", e.target.value)}
          required
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-region`}>Region / State (optional)</Label>
        <Input
          id={`${idPrefix}-region`}
          value={values.region ?? ""}
          onChange={(e) => set("region", e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-postalCode`}>Postal Code (optional)</Label>
        <Input
          id={`${idPrefix}-postalCode`}
          value={values.postalCode ?? ""}
          onChange={(e) => set("postalCode", e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-country`}>Country</Label>
        <Input
          id={`${idPrefix}-country`}
          value={values.country}
          onChange={(e) => set("country", e.target.value)}
          required
          className="mt-1.5"
        />
      </div>
    </div>
  );
}

/**
 * Client-side list/add/edit/delete/set-default UI over /api/addresses(/[id]). Every
 * mutation goes through the API, which re-verifies ownership server-side on every
 * single-resource call (the actual IDOR boundary — see
 * src/app/api/addresses/[id]/route.ts). This component trusts the initial
 * server-rendered list for display only; it never assumes a mutation succeeded without
 * checking the response.
 */
export function AddressManager({ initialAddresses }: { initialAddresses: AddressDTO[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<AddressDTO[]>(initialAddresses);
  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState<AddressFormValues>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AddressFormValues>(EMPTY_FORM);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/addresses");
    if (res.ok) {
      const data = await res.json();
      setAddresses(data.items);
    }
    router.refresh();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPendingId("new");
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not add address.");
      }
      toast.success("Address added.");
      setIsAdding(false);
      setAddForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add address.");
    } finally {
      setPendingId(null);
    }
  };

  const startEdit = (address: AddressDTO) => {
    setEditingId(address.id);
    setEditForm({
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      region: address.region,
      postalCode: address.postalCode,
      country: address.country,
    });
  };

  const handleEditSubmit = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPendingId(id);
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not update address.");
      }
      toast.success("Address updated.");
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update address.");
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setPendingId(id);
    try {
      const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete address.");
      }
      toast.success("Address removed.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete address.");
    } finally {
      setPendingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setError(null);
    setPendingId(id);
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not set default address.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set default address.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {addresses.length === 0 && !isAdding && (
        <p className="text-sm text-muted">You have no saved addresses yet.</p>
      )}

      <div className="space-y-4">
        {addresses.map((address) =>
          editingId === address.id ? (
            <Card key={address.id}>
              <CardContent className="p-6">
                <form onSubmit={(e) => handleEditSubmit(address.id, e)} className="space-y-4">
                  <AddressFields
                    values={editForm}
                    onChange={setEditForm}
                    idPrefix={`edit-${address.id}`}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={pendingId === address.id}>
                      {pendingId === address.id ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card key={address.id}>
              <CardContent className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="text-sm">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-semibold">{address.recipientName}</p>
                      {address.isDefault && <Badge variant="success">Default</Badge>}
                    </div>
                    <p className="text-muted">{address.phone}</p>
                    <p className="text-muted">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                    </p>
                    <p className="text-muted">
                      {[address.city, address.region, address.postalCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="text-muted">{address.country}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!address.isDefault && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pendingId === address.id}
                        onClick={() => handleSetDefault(address.id)}
                      >
                        Set as default
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(address)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pendingId === address.id}
                      onClick={() => handleDelete(address.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {isAdding ? (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleAdd} className="space-y-4">
              <AddressFields values={addForm} onChange={setAddForm} idPrefix="add" />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pendingId === "new"}>
                  {pendingId === "new" ? "Saving…" : "Add Address"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setAddForm(EMPTY_FORM);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button type="button" variant="outline" onClick={() => setIsAdding(true)}>
          Add New Address
        </Button>
      )}
    </div>
  );
}
