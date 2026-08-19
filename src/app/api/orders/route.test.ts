import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { GET, POST } from "./route";

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

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase8-order-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Order Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  return { userId: user.id, email: user.email, name: `Order Route Test ${label}`, role: "customer" };
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `order-route-test-${label}-${runId}`,
      name: `Order Route Test Product (${label})`,
      description: "Test fixture product for order route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "15.00",
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

describe("GET/POST /api/orders", () => {
  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.order.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.cartItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.cart.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.inventoryTransaction.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.address.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated GET and POST with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const getRes = await GET(makeRequest("http://localhost:3000/api/orders"));
    expect(getRes.status).toBe(401);

    const postRes = await POST(
      makeRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId: "does-not-matter" }),
      })
    );
    expect(postRes.status).toBe(401);
  });

  it("POST creates a real PENDING/NOT_PAID order for the caller and GET lists only their own orders", async () => {
    const customer = await createCustomer("post-owner");
    const otherCustomer = await createCustomer("post-other");
    const address = await addressService.create(customer.userId, SAMPLE_ADDRESS);
    const productId = await createProduct("post-owner", 10);

    await cartService.setItem(customer.userId, productId, 2);

    vi.mocked(requireSession).mockResolvedValue(customer);
    const postRes = await POST(
      makeRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId: address.id }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = await postRes.json();
    expect(created.item.status).toBe("PENDING");
    expect(created.item.paymentStatus).toBe("NOT_PAID");

    const stored = await prisma.order.findUniqueOrThrow({ where: { id: created.item.id } });
    expect(stored.userId).toBe(customer.userId);

    vi.mocked(requireSession).mockResolvedValue(customer);
    const getRes = await GET(makeRequest("http://localhost:3000/api/orders"));
    const list = await getRes.json();
    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(created.item.id);

    vi.mocked(requireSession).mockResolvedValue(otherCustomer);
    const otherGetRes = await GET(makeRequest("http://localhost:3000/api/orders"));
    const otherList = await otherGetRes.json();
    expect(otherList.items).toHaveLength(0);
  });

  it("rejects an order-creation request with neither addressId nor shippingAddress", async () => {
    const customer = await createCustomer("bad-input");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await POST(
      makeRequest("http://localhost:3000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });
});
