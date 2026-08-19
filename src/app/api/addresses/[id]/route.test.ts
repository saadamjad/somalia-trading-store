import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { GET, PATCH, DELETE } from "./route";

// Same rationale as src/app/api/products/[id]/route.test.ts: route handlers are
// invoked directly here (no real Next.js HTTP server), so session resolution is
// mocked rather than relying on next-auth's headers()-based request scope. Kept as a
// plain vi.fn() (not a fixed rejected value) so individual tests can set it to resolve
// as a specific logged-in user — this is what makes the IDOR tests below possible.
vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn(),
  };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

function makeRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase6-addr-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({ name: `Route Test ${label}`, email, password: "PlainTextPass1" });
  return { userId: user.id, email: user.email, name: `Route Test ${label}`, role: "customer" };
}

const SAMPLE_ADDRESS = {
  recipientName: "Jane Doe",
  phone: "+252-61-000-0000",
  line1: "Warta Nabadda Road",
  city: "Mogadishu",
  country: "Somalia",
};

describe("GET/PATCH/DELETE /api/addresses/[id]", () => {
  afterAll(async () => {
    await prisma.address.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  describe("unauthenticated requests", () => {
    it("rejects GET/PATCH/DELETE with 401, without touching any data", async () => {
      vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

      const owner = await createCustomer("unauth-owner");
      const address = await addressService.create(owner.userId, SAMPLE_ADDRESS);

      const getRes = await GET(makeRequest(`http://localhost:3000/api/addresses/${address.id}`), {
        params: Promise.resolve({ id: address.id }),
      });
      expect(getRes.status).toBe(401);

      const patchRes = await PATCH(
        makeRequest(`http://localhost:3000/api/addresses/${address.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientName: "Hijacked" }),
        }),
        { params: Promise.resolve({ id: address.id }) }
      );
      expect(patchRes.status).toBe(401);

      const deleteRes = await DELETE(
        makeRequest(`http://localhost:3000/api/addresses/${address.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: address.id }) }
      );
      expect(deleteRes.status).toBe(401);

      const unchanged = await prisma.address.findUniqueOrThrow({ where: { id: address.id } });
      expect(unchanged.recipientName).toBe(SAMPLE_ADDRESS.recipientName);
    });
  });

  describe("IDOR: customer A cannot access customer B's address by direct id manipulation", () => {
    it("GET returns 404 (not B's data) when A requests B's address id", async () => {
      const customerA = await createCustomer("idor-get-a");
      const customerB = await createCustomer("idor-get-b");
      const bAddress = await addressService.create(customerB.userId, SAMPLE_ADDRESS);

      vi.mocked(requireSession).mockResolvedValue(customerA);

      const res = await GET(makeRequest(`http://localhost:3000/api/addresses/${bAddress.id}`), {
        params: Promise.resolve({ id: bAddress.id }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.item).toBeUndefined();
    });

    it("PATCH returns 404 and does not modify B's address when A attempts to edit it", async () => {
      const customerA = await createCustomer("idor-patch-a");
      const customerB = await createCustomer("idor-patch-b");
      const bAddress = await addressService.create(customerB.userId, SAMPLE_ADDRESS);

      vi.mocked(requireSession).mockResolvedValue(customerA);

      const res = await PATCH(
        makeRequest(`http://localhost:3000/api/addresses/${bAddress.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientName: "Hijacked By A" }),
        }),
        { params: Promise.resolve({ id: bAddress.id }) }
      );

      expect(res.status).toBe(404);

      const unchanged = await prisma.address.findUniqueOrThrow({ where: { id: bAddress.id } });
      expect(unchanged.recipientName).toBe(SAMPLE_ADDRESS.recipientName);
    });

    it("DELETE returns 404 and does not delete B's address when A attempts to delete it", async () => {
      const customerA = await createCustomer("idor-delete-a");
      const customerB = await createCustomer("idor-delete-b");
      const bAddress = await addressService.create(customerB.userId, SAMPLE_ADDRESS);

      vi.mocked(requireSession).mockResolvedValue(customerA);

      const res = await DELETE(
        makeRequest(`http://localhost:3000/api/addresses/${bAddress.id}`, { method: "DELETE" }),
        { params: Promise.resolve({ id: bAddress.id }) }
      );

      expect(res.status).toBe(404);

      const stillExists = await prisma.address.findUnique({ where: { id: bAddress.id } });
      expect(stillExists).not.toBeNull();
    });

    it("B can still read/edit/delete their own address after A's failed attempts", async () => {
      const customerB = await createCustomer("idor-self-b");
      const bAddress = await addressService.create(customerB.userId, SAMPLE_ADDRESS);

      vi.mocked(requireSession).mockResolvedValue(customerB);

      const getRes = await GET(makeRequest(`http://localhost:3000/api/addresses/${bAddress.id}`), {
        params: Promise.resolve({ id: bAddress.id }),
      });
      expect(getRes.status).toBe(200);

      const patchRes = await PATCH(
        makeRequest(`http://localhost:3000/api/addresses/${bAddress.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientName: "Updated By Owner" }),
        }),
        { params: Promise.resolve({ id: bAddress.id }) }
      );
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.item.recipientName).toBe("Updated By Owner");
    });
  });
});
