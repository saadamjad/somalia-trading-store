import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { quoteService } from "@/server/services/quote-service";
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

function patchJson(id: string, body: unknown) {
  return makeRequest(`http://localhost:3000/api/admin/quotes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase11-admin-quote-id-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Quote Id Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Admin Quote Id Route Test ${label}`, role: roleName };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `admin-quote-id-route-test-${label}-${runId}`,
      name: `Admin Quote Id Route Test Product (${label})`,
      description: "Test fixture product for admin quote id route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "17.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: 10 } });
  return product.id;
}

describe("GET/PATCH /api/admin/quotes/[id]", () => {
  afterAll(async () => {
    await prisma.quoteStatusHistory.deleteMany({ where: { quote: { contactEmail: { in: testEmails } } } });
    await prisma.quoteItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.quote.deleteMany({ where: { contactEmail: { in: testEmails } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated GET/PATCH with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const getRes = await GET(makeRequest("http://localhost:3000/api/admin/quotes/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(getRes.status).toBe(401);

    const patchRes = await PATCH(patchJson("nope", { status: "REVIEWING" }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(patchRes.status).toBe(401);
  });

  it("rejects a customer without quotes.manage from PATCHing with 403", async () => {
    const customer = await createSessionForRole("no-perm", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await PATCH(patchJson("does-not-matter", { status: "REVIEWING" }), {
      params: Promise.resolve({ id: "does-not-matter" }),
    });
    expect(res.status).toBe(403);
  });

  it("lets an admin with quotes.manage respond with pricing, moving the quote to QUOTED", async () => {
    const admin = await createSessionForRole("respond-admin", "super_admin");
    const customer = await createSessionForRole("respond-customer", "customer");
    const productId = await createProduct("respond");

    const quote = await quoteService.submit(customer.userId, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 2 }],
    });

    vi.mocked(requireSession).mockResolvedValue(admin);
    const res = await PATCH(
      patchJson(quote.id, {
        items: [{ id: quote.items[0].id, quotedUnitPrice: 15.5 }],
        adminNote: "Ready to ship in 2 weeks.",
      }),
      { params: Promise.resolve({ id: quote.id }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("QUOTED");
    expect(body.item.items[0].quotedUnitPrice).toBe(15.5);
  });
});
