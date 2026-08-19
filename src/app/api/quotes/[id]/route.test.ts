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
  return makeRequest(`http://localhost:3000/api/quotes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase11-quote-id-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Quote Id Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  return { userId: user.id, email: user.email, name: `Quote Id Route Test ${label}`, role: "customer" };
}

async function createAdmin(label: string) {
  const customer = await createCustomer(label);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
  await prisma.user.update({ where: { id: customer.userId }, data: { roleId: role.id } });
  return { ...customer, role: "super_admin" };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `quote-id-route-test-${label}-${runId}`,
      name: `Quote Id Route Test Product (${label})`,
      description: "Test fixture product for quote id route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "15.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: 10 } });
  return product.id;
}

describe("GET/PATCH /api/quotes/[id]", () => {
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
    const getRes = await GET(makeRequest("http://localhost:3000/api/quotes/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(getRes.status).toBe(401);

    const patchRes = await PATCH(patchJson("nope", { status: "ACCEPTED" }), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(patchRes.status).toBe(401);
  });

  it("returns 404 (not another customer's quote) when a non-owner requests it — IDOR", async () => {
    const owner = await createCustomer("idor-owner");
    const other = await createCustomer("idor-other");
    const productId = await createProduct("idor");

    const quote = await quoteService.submit(owner.userId, {
      name: owner.name,
      email: owner.email,
      items: [{ productId, quantity: 1 }],
    });

    vi.mocked(requireSession).mockResolvedValue(other);
    const res = await GET(makeRequest(`http://localhost:3000/api/quotes/${quote.id}`), {
      params: Promise.resolve({ id: quote.id }),
    });
    expect(res.status).toBe(404);
  });

  it("lets the owning customer accept a QUOTED quote via PATCH", async () => {
    const owner = await createCustomer("accept-owner");
    const admin = await createAdmin("accept-admin");
    const productId = await createProduct("accept");

    const quote = await quoteService.submit(owner.userId, {
      name: owner.name,
      email: owner.email,
      items: [{ productId, quantity: 2 }],
    });
    await quoteService.respond(quote.id, admin.userId, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: 12 }],
    });

    vi.mocked(requireSession).mockResolvedValue(owner);
    const res = await PATCH(patchJson(quote.id, { status: "ACCEPTED" }), {
      params: Promise.resolve({ id: quote.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("ACCEPTED");
  });
});
