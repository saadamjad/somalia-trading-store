import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET, POST } from "./route";

// Same pattern as src/app/api/admin/quotes/route.test.ts: exercise the real
// session -> role -> permission lookup against the DB, only faking "who is calling".
vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn(),
  };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

function makePostRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const bannerIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase12-admin-banners-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Banners Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Admin Banners Route Test ${label}`, role: roleName, mustChangePassword: false };
}

describe("/api/admin/cms/banners — permission enforcement", () => {
  afterAll(async () => {
    await prisma.banner.deleteMany({ where: { id: { in: bannerIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("GET rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET rejects an authenticated customer (no cms.view) with 403", async () => {
    const customer = await createSessionForRole("no-perm-get", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("GET succeeds for an admin with cms.view", async () => {
    const admin = await createSessionForRole("has-view", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("POST rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await POST(
      makePostRequest("http://localhost:3000/api/admin/cms/banners", {
        slot: "HOMEPAGE_HERO",
        title: "Should not be created",
      })
    );
    expect(res.status).toBe(401);
  });

  it("POST rejects an authenticated customer (no cms.manage) with 403", async () => {
    const customer = await createSessionForRole("no-perm-post", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await POST(
      makePostRequest("http://localhost:3000/api/admin/cms/banners", {
        slot: "HOMEPAGE_HERO",
        title: "Should not be created",
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST succeeds for an admin with cms.manage", async () => {
    const admin = await createSessionForRole("has-manage", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await POST(
      makePostRequest("http://localhost:3000/api/admin/cms/banners", {
        slot: "HOMEPAGE_HERO",
        title: `Phase12 Route Test Banner ${runId}`,
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    bannerIds.push(body.item.id);
  });
});
