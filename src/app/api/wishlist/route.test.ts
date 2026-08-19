import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET, POST } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn(),
  };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

function makeRequest(body: unknown) {
  return new NextRequest(new URL("http://localhost:3000/api/wishlist"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase7-wishlist-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({ name: `Wishlist Route Test ${label}`, email, password: "PlainTextPass1" });
  return { userId: user.id, email: user.email, name: `Wishlist Route Test ${label}`, role: "customer" };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `wishlist-route-test-${label}-${runId}`,
      name: `Wishlist Route Test Product (${label})`,
      description: "Test fixture.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "10.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  return product.id;
}

describe("GET/POST /api/wishlist", () => {
  afterAll(async () => {
    await prisma.wishlistItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.wishlist.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated GET and POST with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    expect((await GET()).status).toBe(401);
    expect((await POST(makeRequest({ productId: "x" }))).status).toBe(401);
  });

  it("duplicate-prevention holds even when the client sends the same POST twice — only one WishlistItem row exists", async () => {
    const customer = await createCustomer("dup-route");
    const productId = await createProduct("dup-route");

    vi.mocked(requireSession).mockResolvedValue(customer);
    await POST(makeRequest({ productId }));
    const res = await POST(makeRequest({ productId }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.items).toHaveLength(1);

    const wishlist = await prisma.wishlist.findUniqueOrThrow({
      where: { userId: customer.userId },
      include: { items: true },
    });
    expect(wishlist.items).toHaveLength(1);
  });

  it("operates only on the caller's own wishlist — no wishlist/user id is ever read from the request body", async () => {
    const customerA = await createCustomer("idor-a");
    const customerB = await createCustomer("idor-b");
    const productId = await createProduct("idor");

    vi.mocked(requireSession).mockResolvedValue(customerB);
    await POST(makeRequest({ productId }));

    vi.mocked(requireSession).mockResolvedValue(customerA);
    await POST(makeRequest({ productId, userId: customerB.userId }));

    const wishlistA = await prisma.wishlist.findUniqueOrThrow({
      where: { userId: customerA.userId },
      include: { items: true },
    });
    const wishlistB = await prisma.wishlist.findUniqueOrThrow({
      where: { userId: customerB.userId },
      include: { items: true },
    });
    expect(wishlistA.items).toHaveLength(1);
    expect(wishlistB.items).toHaveLength(1);
  });
});
