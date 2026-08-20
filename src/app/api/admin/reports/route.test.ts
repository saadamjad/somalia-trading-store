import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn(),
  };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase14-reports-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Reports Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Reports Route Test ${label}`, role: roleName };
}

describe("GET /api/admin/reports — permission enforcement", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports?type=orders"));
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated customer (no reports.view permission) with 403", async () => {
    const customer = await createSessionForRole("no-perm", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports?type=orders"));
    expect(res.status).toBe(403);
  });

  it("an admin with reports.view gets a report payload with no revenue-implying fields", async () => {
    const admin = await createSessionForRole("has-perm", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports?type=orders"));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.rows).toBeInstanceOf(Array);
    expect(body.columns).toBeInstanceOf(Array);

    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain("revenue");
  });
});
