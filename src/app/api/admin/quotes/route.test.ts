import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { quoteService } from "@/server/services/quote-service";
import { GET } from "./route";

// `requirePermission` is left un-mocked so this test exercises the real
// session -> role -> permission lookup against the DB (same pattern as
// src/app/api/admin/orders/route.test.ts) — only `requireSession`'s underlying
// "who is calling" is faked.
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
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase11-admin-quotes-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Quotes Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Admin Quotes Route Test ${label}`, role: roleName };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `admin-quotes-route-test-${label}-${runId}`,
      name: `Admin Quotes Route Test Product (${label})`,
      description: "Test fixture product for admin quotes route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "22.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: 10 } });
  return product.id;
}

describe("GET /api/admin/quotes — permission enforcement", () => {
  afterAll(async () => {
    await prisma.quoteStatusHistory.deleteMany({ where: { quote: { contactEmail: { in: testEmails } } } });
    await prisma.quoteItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.quote.deleteMany({ where: { contactEmail: { in: testEmails } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET(makeRequest("http://localhost:3000/api/admin/quotes"));
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated customer (no quotes.view permission) with 403", async () => {
    const customer = await createSessionForRole("no-perm", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/quotes"));
    expect(res.status).toBe(403);
  });

  it("an admin with quotes.view can list quotes across customers", async () => {
    const admin = await createSessionForRole("has-perm", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const customer = await createSessionForRole("target-customer", "customer");
    const productId = await createProduct("list");
    const quote = await quoteService.submit(customer.userId, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 1 }],
    });

    const res = await GET(makeRequest("http://localhost:3000/api/admin/quotes?pageSize=100"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.some((item: { id: string }) => item.id === quote.id)).toBe(true);
  });
});
