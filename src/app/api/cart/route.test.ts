import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET, POST, PUT, DELETE } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn(),
  };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

function makeRequest(body?: unknown, method = "POST") {
  return new NextRequest(new URL("http://localhost:3000/api/cart"), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase7-cart-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({ name: `Cart Route Test ${label}`, email, password: "PlainTextPass1" });
  return { userId: user.id, email: user.email, name: `Cart Route Test ${label}`, role: "customer" };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `cart-route-test-${label}-${runId}`,
      name: `Cart Route Test Product (${label})`,
      description: "Test fixture.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "10.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: 50 } });
  return product.id;
}

describe("GET/POST/PUT/DELETE /api/cart", () => {
  afterAll(async () => {
    await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated requests with 401 on every method", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    expect((await GET()).status).toBe(401);
    expect((await POST(makeRequest({ productId: "x", quantity: 1 }))).status).toBe(401);
    expect((await PUT(makeRequest({ items: [] }, "PUT"))).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
  });

  it(
    "operates only on the caller's own cart — there is no cart/user id anywhere in the " +
      "request the caller controls, so there's no IDOR surface by design: POST/GET " +
      "always resolve to `requireSession()`'s userId, never a client-supplied id",
    async () => {
      const customerA = await createCustomer("idor-a");
      const customerB = await createCustomer("idor-b");
      const productId = await createProduct("idor");

      vi.mocked(requireSession).mockResolvedValue(customerB);
      await POST(makeRequest({ productId, quantity: 3 }));

      // Even if a malicious body tried to smuggle a different userId, POST/GET never
      // read one — they only ever use the session's userId.
      vi.mocked(requireSession).mockResolvedValue(customerA);
      const res = await POST(
        makeRequest({ productId, quantity: 1, userId: customerB.userId })
      );
      const data = await res.json();
      expect(data.items).toHaveLength(1);

      const cartA = await prisma.cart.findUniqueOrThrow({
        where: { userId: customerA.userId },
        include: { items: true },
      });
      const cartB = await prisma.cart.findUniqueOrThrow({
        where: { userId: customerB.userId },
        include: { items: true },
      });
      expect(cartA.items[0].quantity).toBe(1);
      expect(cartB.items[0].quantity).toBe(3);
    }
  );

  it("POST creates exactly one CartItem row and updates quantity on repeat calls", async () => {
    const customer = await createCustomer("upsert-route");
    const productId = await createProduct("upsert-route");

    vi.mocked(requireSession).mockResolvedValue(customer);
    await POST(makeRequest({ productId, quantity: 2 }));
    const res = await POST(makeRequest({ productId, quantity: 6 }));
    const data = await res.json();

    expect(data.items).toHaveLength(1);
    expect(data.items[0].quantity).toBe(6);
  });

  it("PUT merges guest items into the server cart, summing on conflict", async () => {
    const customer = await createCustomer("merge-route");
    const productId = await createProduct("merge-route");

    vi.mocked(requireSession).mockResolvedValue(customer);
    await POST(makeRequest({ productId, quantity: 2 }));
    const res = await PUT(makeRequest({ items: [{ productId, quantity: 5 }] }, "PUT"));
    const data = await res.json();

    expect(data.items).toHaveLength(1);
    expect(data.items[0].quantity).toBe(7);
  });

  it("DELETE clears the cart", async () => {
    const customer = await createCustomer("clear-route");
    const productId = await createProduct("clear-route");

    vi.mocked(requireSession).mockResolvedValue(customer);
    await POST(makeRequest({ productId, quantity: 2 }));
    const res = await DELETE();
    expect(res.status).toBe(204);

    const getRes = await GET();
    const data = await getRes.json();
    expect(data.items).toHaveLength(0);
  });
});
