import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { PATCH } from "./route";

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
  const email = `phase6-account-pw-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string, password = "PlainTextPass1") {
  const email = uniqueEmail(label);
  const user = await authService.register({ name: `Password Route ${label}`, email, password });
  return { userId: user.id, email: user.email, name: `Password Route ${label}`, role: "customer", password };
}

describe("PATCH /api/account/password", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const res = await PATCH(
      makeRequest("http://localhost:3000/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "whatever",
          newPassword: "BrandNewPass1",
          confirmPassword: "BrandNewPass1",
        }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects the wrong current password (400) and does not change the password", async () => {
    const customer = await createCustomer("wrong-current");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await PATCH(
      makeRequest("http://localhost:3000/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "WrongPassword1",
          newPassword: "BrandNewPass1",
          confirmPassword: "BrandNewPass1",
        }),
      })
    );

    expect(res.status).toBe(400);

    const stillOld = await authService.verifyCredentials(customer.email, customer.password);
    expect(stillOld).not.toBeNull();
  });

  it("changes the password with the correct current password", async () => {
    const customer = await createCustomer("correct-current");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await PATCH(
      makeRequest("http://localhost:3000/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: customer.password,
          newPassword: "BrandNewPass1",
          confirmPassword: "BrandNewPass1",
        }),
      })
    );

    expect(res.status).toBe(200);

    const withNew = await authService.verifyCredentials(customer.email, "BrandNewPass1");
    expect(withNew).not.toBeNull();
  });
});
