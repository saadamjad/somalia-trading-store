import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET, PATCH } from "./route";

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
  const email = `phase6-account-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({ name: `Account Route ${label}`, email, password: "PlainTextPass1" });
  return { userId: user.id, email: user.email, name: `Account Route ${label}`, role: "customer" };
}

describe("GET/PATCH /api/account", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated GET and PATCH with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const getRes = await GET();
    expect(getRes.status).toBe(401);

    const patchRes = await PATCH(
      makeRequest("http://localhost:3000/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hijacked" }),
      })
    );
    expect(patchRes.status).toBe(401);
  });

  it("GET returns only the caller's own profile", async () => {
    const customer = await createCustomer("get-own");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.item.email).toBe(customer.email);
  });

  it("PATCH updates only the caller's own profile, ignoring any client-supplied id targeting another user", async () => {
    const customerA = await createCustomer("patch-a");
    const customerB = await createCustomer("patch-b");

    vi.mocked(requireSession).mockResolvedValue(customerA);
    const res = await PATCH(
      makeRequest("http://localhost:3000/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Even if a malicious client includes an id/userId field aimed at B, the
        // service only ever acts on the session's own userId — there is no id
        // parameter on this route to manipulate in the first place.
        body: JSON.stringify({ name: "A's New Name", userId: customerB.userId }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.item.name).toBe("A's New Name");

    const bUnchanged = await prisma.user.findUniqueOrThrow({ where: { id: customerB.userId } });
    expect(bUnchanged.name).toBe(`Account Route patch-b`);
  });

  it("changing email requires the current password and rejects a taken email cleanly", async () => {
    const customer = await createCustomer("email-change");
    const other = await createCustomer("email-taken");

    vi.mocked(requireSession).mockResolvedValue(customer);

    const noPasswordRes = await PATCH(
      makeRequest("http://localhost:3000/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: uniqueEmail("new-no-pw") }),
      })
    );
    expect(noPasswordRes.status).toBe(400);

    const takenRes = await PATCH(
      makeRequest("http://localhost:3000/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: other.email, currentPassword: "PlainTextPass1" }),
      })
    );
    expect(takenRes.status).toBe(409);
    const body = await takenRes.json();
    expect(body.error).not.toMatch(/stack|prisma|P2002/i);
  });
});
