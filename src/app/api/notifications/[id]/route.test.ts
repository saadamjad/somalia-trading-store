import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
import { notificationService } from "@/server/services/notification-service";
import { PATCH } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn(),
  };
});

import { requireSession, UnauthenticatedError } from "@/server/auth/session";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), { method: "PATCH" });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase15-notification-id-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Notification Id Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  return { userId: user.id, email: user.email, name: `Notification Id Route Test ${label}`, role: "customer", mustChangePassword: false };
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
      slug: `notification-id-route-test-${label}-${runId}`,
      name: `Notification Id Route Test Product (${label})`,
      description: "Test fixture product for notification id route tests.",
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

describe("/api/notifications/[id]", () => {
  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user: { email: { in: testEmails } } } });
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

  it("PATCH rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await PATCH(makeRequest("http://localhost:3000/api/notifications/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("PATCH marks the caller's own notification read", async () => {
    const customer = await createCustomer("markread-happy");
    const admin = await createAdminSession("markread-happy-admin");
    const order = await placeOrder(customer.userId);
    await orderService.updateStatus(order.id, admin.userId, "CONFIRMED");

    const [notification] = await notificationService.listForUser(customer.userId);

    vi.mocked(requireSession).mockResolvedValue(customer);
    const res = await PATCH(
      makeRequest(`http://localhost:3000/api/notifications/${notification.id}`),
      { params: Promise.resolve({ id: notification.id }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.read).toBe(true);
  });

  it("IDOR: PATCH for another customer's notification returns 404, and leaves it unread", async () => {
    const customerA = await createCustomer("idor-a");
    const customerB = await createCustomer("idor-b");
    const admin = await createAdminSession("idor-admin");
    const order = await placeOrder(customerA.userId);
    await orderService.updateStatus(order.id, admin.userId, "CONFIRMED");

    const [notification] = await notificationService.listForUser(customerA.userId);

    vi.mocked(requireSession).mockResolvedValue(customerB);
    const res = await PATCH(
      makeRequest(`http://localhost:3000/api/notifications/${notification.id}`),
      { params: Promise.resolve({ id: notification.id }) }
    );

    expect(res.status).toBe(404);

    const stillUnread = await prisma.notification.findUniqueOrThrow({ where: { id: notification.id } });
    expect(stillUnread.read).toBe(false);
  });
});
