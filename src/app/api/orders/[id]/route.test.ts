import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
import { GET } from "./route";

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
  const email = `phase8-order-id-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Order Id Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  return { userId: user.id, email: user.email, name: `Order Id Route Test ${label}`, role: "customer" };
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `order-id-route-test-${label}-${runId}`,
      name: `Order Id Route Test Product (${label})`,
      description: "Test fixture product for order [id] route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "12.00",
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

async function placeOrder(userId: string) {
  const address = await addressService.create(userId, SAMPLE_ADDRESS);
  const productId = await createProduct(`for-${userId}`, 10);
  await cartService.setItem(userId, productId, 1);
  return orderService.createOrder(userId, { addressId: address.id });
}

describe("GET /api/orders/[id]", () => {
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

  it("rejects unauthenticated requests with 401, without leaking order data", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const owner = await createCustomer("unauth-owner");
    const order = await placeOrder(owner.userId);

    const res = await GET(makeRequest(`http://localhost:3000/api/orders/${order.id}`), {
      params: Promise.resolve({ id: order.id }),
    });
    expect(res.status).toBe(401);
  });

  it("IDOR: customer A gets 404 (not 403, and not the data) when requesting customer B's order id", async () => {
    const customerA = await createCustomer("idor-a");
    const customerB = await createCustomer("idor-b");
    const bOrder = await placeOrder(customerB.userId);

    vi.mocked(requireSession).mockResolvedValue(customerA);
    const res = await GET(makeRequest(`http://localhost:3000/api/orders/${bOrder.id}`), {
      params: Promise.resolve({ id: bOrder.id }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.item).toBeUndefined();
  });

  it("a guessed/enumerated nonexistent order id also gets 404", async () => {
    const customer = await createCustomer("guess");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET(makeRequest("http://localhost:3000/api/orders/nonexistent-id"), {
      params: Promise.resolve({ id: "nonexistent-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("the owner can retrieve their own order successfully", async () => {
    const owner = await createCustomer("self-owner");
    const order = await placeOrder(owner.userId);

    vi.mocked(requireSession).mockResolvedValue(owner);
    const res = await GET(makeRequest(`http://localhost:3000/api/orders/${order.id}`), {
      params: Promise.resolve({ id: order.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe(order.id);
  });
});
