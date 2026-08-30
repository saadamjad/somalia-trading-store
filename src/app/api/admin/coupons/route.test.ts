import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET, POST } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return { ...actual, requireSession: vi.fn() };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const couponCodes: string[] = [];

function uniqueEmail(label: string) {
  const email = `admin-coupons-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

function uniqueCode(label: string) {
  const code = `ADMIN-COUPON-ROUTE-${label.toUpperCase()}-${runId}`;
  couponCodes.push(code);
  return code;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Coupons Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }
  return { userId: user.id, email: user.email, name: user.name, role: roleName, mustChangePassword: false };
}

function makeRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function postJson(url: string, body: unknown) {
  return makeRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/admin/coupons", () => {
  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { code: { in: couponCodes } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("GET rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET rejects staff (no coupons.view) with 403", async () => {
    const staff = await createSessionForRole("no-perm", "staff");
    vi.mocked(requireSession).mockResolvedValue(staff);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("POST creates a coupon for an admin with coupons.manage, normalizing the code to uppercase", async () => {
    const admin = await createSessionForRole("create", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const code = uniqueCode("create").toLowerCase();
    couponCodes.push(code.toUpperCase());
    const res = await POST(
      postJson("http://localhost:3000/api/admin/coupons", { code, type: "FIXED", value: 10 })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.code).toBe(code.toUpperCase());
  });

  it("POST rejects a percentage value over 100 with 400", async () => {
    const admin = await createSessionForRole("bad-pct", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await POST(
      postJson("http://localhost:3000/api/admin/coupons", {
        code: uniqueCode("bad-pct"),
        type: "PERCENTAGE",
        value: 150,
      })
    );
    expect(res.status).toBe(400);
  });
});
