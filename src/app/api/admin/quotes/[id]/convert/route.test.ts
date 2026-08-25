import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { quoteService } from "@/server/services/quote-service";
import { POST } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn(),
  };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

function makeRequest(id: string, body: unknown) {
  return new NextRequest(new URL(`http://localhost:3000/api/admin/quotes/${id}/convert`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase11-quote-convert-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Quote Convert Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Quote Convert Route Test ${label}`, role: roleName, mustChangePassword: false };
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `quote-convert-route-test-${label}-${runId}`,
      name: `Quote Convert Route Test Product (${label})`,
      description: "Test fixture product for quote convert route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "60.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: stock } });
  return product.id;
}

const SAMPLE_ADDRESS = {
  recipientName: "Jane Doe",
  phone: "+252-61-000-0000",
  line1: "Warta Nabadda Road",
  city: "Mogadishu",
  country: "Somalia",
};

describe("POST /api/admin/quotes/[id]/convert", () => {
  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.order.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.quoteStatusHistory.deleteMany({ where: { quote: { contactEmail: { in: testEmails } } } });
    await prisma.quoteItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.quote.deleteMany({ where: { contactEmail: { in: testEmails } } });
    await prisma.inventoryTransaction.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.address.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated conversion with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await POST(makeRequest("does-not-matter", { shippingAddress: SAMPLE_ADDRESS }), {
      params: Promise.resolve({ id: "does-not-matter" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a customer without quotes.manage with 403", async () => {
    const customer = await createSessionForRole("no-perm", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await POST(makeRequest("does-not-matter", { shippingAddress: SAMPLE_ADDRESS }), {
      params: Promise.resolve({ id: "does-not-matter" }),
    });
    expect(res.status).toBe(403);
  });

  it("converts an ACCEPTED quote into a real Order priced at the quoted price, decrementing stock", async () => {
    const admin = await createSessionForRole("convert-admin", "super_admin");
    const customer = await createSessionForRole("convert-customer", "customer");
    const productId = await createProduct("convert", 10);
    await addressService.create(customer.userId, SAMPLE_ADDRESS);

    const quote = await quoteService.submit(customer.userId, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 3 }],
    });
    await quoteService.respond(quote.id, admin.userId, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: 55 }],
    });
    await quoteService.customerUpdateStatus(quote.id, customer.userId, "ACCEPTED");

    vi.mocked(requireSession).mockResolvedValue(admin);
    const res = await POST(makeRequest(quote.id, { shippingAddress: SAMPLE_ADDRESS }), {
      params: Promise.resolve({ id: quote.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.status).toBe("CONVERTED");
    expect(body.order.status).toBe("PENDING");
    expect(body.order.paymentStatus).toBe("NOT_PAID");
    expect(body.order.items[0].unitPrice).toBe(55);

    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(inventory.quantity).toBe(7);
  });

  it("rejects conversion when current stock no longer covers the quoted quantity", async () => {
    const admin = await createSessionForRole("stock-admin", "super_admin");
    const customer = await createSessionForRole("stock-customer", "customer");
    const productId = await createProduct("stock", 1);
    await addressService.create(customer.userId, SAMPLE_ADDRESS);

    const quote = await quoteService.submit(customer.userId, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 5 }],
    });
    await quoteService.respond(quote.id, admin.userId, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: 55 }],
    });
    await quoteService.customerUpdateStatus(quote.id, customer.userId, "ACCEPTED");

    vi.mocked(requireSession).mockResolvedValue(admin);
    const res = await POST(makeRequest(quote.id, { shippingAddress: SAMPLE_ADDRESS }), {
      params: Promise.resolve({ id: quote.id }),
    });

    expect(res.status).toBe(409);
    const storedQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(storedQuote.status).toBe("ACCEPTED");
  });
});
