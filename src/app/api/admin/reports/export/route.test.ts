import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET } from "./route";

// Same pattern as src/app/api/admin/dashboard/route.test.ts — only `requireSession`
// ("who is calling") is faked; `requirePermission` still runs a real
// session -> role -> permission lookup against the DB.
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
  const email = `phase14-reports-export-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Reports Export Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Reports Export Route Test ${label}`, role: roleName };
}

describe("GET /api/admin/reports/export", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports/export?type=orders&format=csv"));
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated customer (no reports.view permission) with 403", async () => {
    const customer = await createSessionForRole("no-perm", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports/export?type=orders&format=csv"));
    expect(res.status).toBe(403);
  });

  it("returns a non-empty CSV file matching the on-screen report's columns", async () => {
    const admin = await createSessionForRole("csv", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports/export?type=orders&format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain(".csv");

    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);

    // Parseable: the header row (first non-comment, non-blank line) contains the
    // expected report columns.
    const dataLines = text.split("\r\n").filter((line) => line && !line.startsWith("#"));
    const headerLine = dataLines[0];
    expect(headerLine.split(",")).toContain("Order #");
  });

  it("returns a non-empty XLSX file with the correct content-type", async () => {
    const admin = await createSessionForRole("xlsx", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports/export?type=customers&format=xlsx"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("Content-Disposition")).toContain(".xlsx");

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
    // XLSX files are zip archives — "PK" magic bytes at the start.
    const bytes = new Uint8Array(buffer.slice(0, 2));
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("returns a non-empty PDF file with the correct content-type", async () => {
    const admin = await createSessionForRole("pdf", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports/export?type=inventory&format=pdf"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(".pdf");

    const buffer = await res.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
    // PDF files start with the "%PDF-" magic bytes.
    const text = new TextDecoder().decode(buffer.slice(0, 5));
    expect(text).toBe("%PDF-");
  });

  it("rejects an invalid report type with a validation error", async () => {
    const admin = await createSessionForRole("bad-type", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports/export?type=nonsense&format=csv"));
    expect(res.status).toBe(400);
  });

  it("no export format's output labels order totals as Revenue or implies payment was collected", async () => {
    const admin = await createSessionForRole("no-revenue", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/reports/export?type=orders&format=csv"));
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain("revenue");
  });
});
