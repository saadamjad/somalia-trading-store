import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
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

function postJson(url: string, body: unknown) {
  return makeRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase10-refund-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Refund Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  return { userId: user.id, email: user.email, name: `Refund Route Test ${label}`, role: "customer", mustChangePassword: false };
}

async function createAdminSession(label: string) {
  const customer = await createCustomer(label);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
  await prisma.user.update({ where: { id: customer.userId }, data: { roleId: role.id } });
  return { ...customer, role: "super_admin" };
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `refund-route-test-${label}-${runId}`,
      name: `Refund Route Test Product (${label})`,
      description: "Test fixture product for refund route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "18.00",
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

async function confirmOrder(orderId: string, adminId: string) {
  await orderService.updateStatus(orderId, adminId, "CONFIRMED");
}

describe("/api/refund-requests", () => {
  afterAll(async () => {
    await prisma.refundRequestStatusHistory.deleteMany({
      where: { refundRequest: { requestedBy: { email: { in: testEmails } } } },
    });
    await prisma.refundRequest.deleteMany({ where: { requestedBy: { email: { in: testEmails } } } });
    await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { user: { email: { in: testEmails } } } } });
    await prisma.paymentStatusHistory.deleteMany({ where: { order: { user: { email: { in: testEmails } } } } });
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

  it("POST rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await POST(postJson("http://localhost:3000/api/refund-requests", { orderId: "x", reasonCategory: "OTHER" }));
    expect(res.status).toBe(401);
  });

  it("POST creates a refund request for the caller's own eligible order", async () => {
    const customer = await createCustomer("create-happy");
    const admin = await createAdminSession("create-happy-admin");
    const order = await placeOrder(customer.userId);
    await confirmOrder(order.id, admin.userId);

    vi.mocked(requireSession).mockResolvedValue(customer);
    const res = await POST(
      postJson("http://localhost:3000/api/refund-requests", {
        orderId: order.id,
        reasonCategory: "DAMAGED",
        reasonDetail: "Broken on arrival",
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.status).toBe("REQUESTED");
    expect(body.item.order.id).toBe(order.id);
  });

  it("IDOR: POST for another customer's order returns 404, not the created resource", async () => {
    const customerA = await createCustomer("idor-post-a");
    const customerB = await createCustomer("idor-post-b");
    const admin = await createAdminSession("idor-post-admin");
    const bOrder = await placeOrder(customerB.userId);
    await confirmOrder(bOrder.id, admin.userId);

    vi.mocked(requireSession).mockResolvedValue(customerA);
    const res = await POST(
      postJson("http://localhost:3000/api/refund-requests", {
        orderId: bOrder.id,
        reasonCategory: "OTHER",
      })
    );

    expect(res.status).toBe(404);
  });

  it("rejects a refund request for a PENDING order with a 400 (server-enforced eligibility rule)", async () => {
    const customer = await createCustomer("pending-route");
    const order = await placeOrder(customer.userId); // still PENDING

    vi.mocked(requireSession).mockResolvedValue(customer);
    const res = await POST(
      postJson("http://localhost:3000/api/refund-requests", {
        orderId: order.id,
        reasonCategory: "OTHER",
      })
    );

    expect(res.status).toBe(400);
  });

  it("GET returns only the caller's own refund requests", async () => {
    const customerA = await createCustomer("list-a");
    const customerB = await createCustomer("list-b");
    const admin = await createAdminSession("list-admin");

    const orderA = await placeOrder(customerA.userId);
    await confirmOrder(orderA.id, admin.userId);
    const orderB = await placeOrder(customerB.userId);
    await confirmOrder(orderB.id, admin.userId);

    vi.mocked(requireSession).mockResolvedValue(customerA);
    await POST(
      postJson("http://localhost:3000/api/refund-requests", {
        orderId: orderA.id,
        reasonCategory: "OTHER",
      })
    );

    vi.mocked(requireSession).mockResolvedValue(customerB);
    await POST(
      postJson("http://localhost:3000/api/refund-requests", {
        orderId: orderB.id,
        reasonCategory: "OTHER",
      })
    );

    vi.mocked(requireSession).mockResolvedValue(customerA);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].order.id).toBe(orderA.id);
  });
});
