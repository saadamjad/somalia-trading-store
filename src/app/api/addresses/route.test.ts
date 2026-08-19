import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { GET, POST } from "./route";

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
  const email = `phase6-addr-list-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({ name: `List Test ${label}`, email, password: "PlainTextPass1" });
  return { userId: user.id, email: user.email, name: `List Test ${label}`, role: "customer" };
}

const SAMPLE_ADDRESS = {
  recipientName: "Jane Doe",
  phone: "+252-61-000-0000",
  line1: "Warta Nabadda Road",
  city: "Mogadishu",
  country: "Somalia",
};

describe("GET/POST /api/addresses", () => {
  afterAll(async () => {
    await prisma.address.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated GET and POST with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const getRes = await GET();
    expect(getRes.status).toBe(401);

    const postRes = await POST(
      makeRequest("http://localhost:3000/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLE_ADDRESS),
      })
    );
    expect(postRes.status).toBe(401);
  });

  it("GET only returns the caller's own addresses, not another customer's", async () => {
    const customerA = await createCustomer("scope-a");
    const customerB = await createCustomer("scope-b");

    await addressService.create(customerA.userId, SAMPLE_ADDRESS);
    await addressService.create(customerB.userId, SAMPLE_ADDRESS);
    await addressService.create(customerB.userId, { ...SAMPLE_ADDRESS, recipientName: "Second" });

    vi.mocked(requireSession).mockResolvedValue(customerA);
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
  });

  it("POST creates an address owned by the caller, ignoring any client-supplied userId", async () => {
    const customer = await createCustomer("post-owner");

    vi.mocked(requireSession).mockResolvedValue(customer);
    const res = await POST(
      makeRequest("http://localhost:3000/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...SAMPLE_ADDRESS, userId: "some-other-user-id" }),
      })
    );

    expect(res.status).toBe(201);
    const data = await res.json();

    const stored = await prisma.address.findUniqueOrThrow({ where: { id: data.item.id } });
    expect(stored.userId).toBe(customer.userId);
  });
});
