import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
import { refundRequestService } from "@/server/services/refund-request-service";
import { quoteService } from "@/server/services/quote-service";
import {
  notificationService,
  NotificationNotFoundError,
} from "@/server/services/notification-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase15-notification-service-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Notification Service Test ${label}`,
    email: uniqueEmail(label),
    password: "PlainTextPass1",
  });
}

async function createAdmin(label: string) {
  const user = await createCustomer(label);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
  await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  return user;
}

async function createProduct(label: string, stock: number, price = "25.00") {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `notification-service-test-${label}-${runId}`,
      name: `Notification Service Test Product (${label})`,
      description: "Test fixture product for notification service tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price,
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

describe("notificationService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.refundRequestStatusHistory.deleteMany({
      where: { refundRequest: { requestedBy: { email: { in: testEmails } } } },
    });
    await prisma.refundRequest.deleteMany({ where: { requestedBy: { email: { in: testEmails } } } });
    await prisma.quoteStatusHistory.deleteMany({ where: { quote: { contactEmail: { in: testEmails } } } });
    await prisma.quoteItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.quote.deleteMany({ where: { contactEmail: { in: testEmails } } });
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

  it("an order status change creates a Notification for the correct customer, and calls the stubbed email notifier", async () => {
    const customer = await createCustomer("order-status");
    const admin = await createAdmin("order-status-admin");
    const order = await placeOrder(customer.id);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await confirmOrder(order.id, admin.id);

    const notifications = await notificationService.listForUser(customer.id);
    const match = notifications.find(
      (n) => n.type === "ORDER_STATUS_CHANGED" && n.relatedEntityId === order.id
    );
    expect(match).toBeDefined();
    expect(match?.relatedEntityType).toBe("ORDER");
    expect(match?.message).toContain("CONFIRMED");
    expect(match?.read).toBe(false);

    // The stubbed email "channel" is exercised at the same trigger point.
    expect(logSpy).toHaveBeenCalled();
    expect(
      logSpy.mock.calls.some((call) =>
        String(call[0]).includes("[email-notifier] would send email to")
      )
    ).toBe(true);
  });

  it("a refund request approval creates a Notification for the requesting customer", async () => {
    const customer = await createCustomer("refund-approve");
    const admin = await createAdmin("refund-approve-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const refundRequest = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "DAMAGED",
    });

    await refundRequestService.updateStatus(refundRequest.id, admin.id, "APPROVED");

    const notifications = await notificationService.listForUser(customer.id);
    const match = notifications.find(
      (n) => n.type === "REFUND_REQUEST_UPDATED" && n.relatedEntityId === refundRequest.id
    );
    expect(match).toBeDefined();
    expect(match?.relatedEntityType).toBe("REFUND_REQUEST");
    expect(match?.title.toLowerCase()).toContain("approved");
  });

  it("a refund request rejection creates a Notification for the requesting customer", async () => {
    const customer = await createCustomer("refund-reject");
    const admin = await createAdmin("refund-reject-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const refundRequest = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "OTHER",
    });

    await refundRequestService.updateStatus(refundRequest.id, admin.id, "REJECTED");

    const notifications = await notificationService.listForUser(customer.id);
    const match = notifications.find(
      (n) => n.type === "REFUND_REQUEST_UPDATED" && n.relatedEntityId === refundRequest.id
    );
    expect(match).toBeDefined();
    expect(match?.title.toLowerCase()).toContain("rejected");
  });

  it("a quote response (QUOTED) creates a Notification for the quote's user", async () => {
    const customer = await createCustomer("quote-response");
    const admin = await createAdmin("quote-response-admin");
    const productId = await createProduct("quote-response", 10, "30.00");

    const quote = await quoteService.submit(customer.id, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 2 }],
    });

    await quoteService.respond(quote.id, admin.id, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: 27.5 }],
    });

    const notifications = await notificationService.listForUser(customer.id);
    const match = notifications.find(
      (n) => n.type === "QUOTE_RESPONSE" && n.relatedEntityId === quote.id
    );
    expect(match).toBeDefined();
    expect(match?.relatedEntityType).toBe("QUOTE");
  });

  it("a guest quote's response does NOT attempt an in-app notification (no userId to notify)", async () => {
    const admin = await createAdmin("quote-guest-admin");
    const productId = await createProduct("quote-guest", 10, "30.00");
    const guestEmail = uniqueEmail("quote-guest-contact");

    const quote = await quoteService.submit(null, {
      name: "Guest Buyer",
      email: guestEmail,
      items: [{ productId, quantity: 1 }],
    });

    await quoteService.respond(quote.id, admin.id, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: 29 }],
    });

    const countByRelated = await prisma.notification.count({
      where: { relatedEntityType: "QUOTE", relatedEntityId: quote.id },
    });
    expect(countByRelated).toBe(0);
  });

  it("markRead updates the notification's read state, and rejects marking another customer's notification (IDOR)", async () => {
    const customerA = await createCustomer("markread-a");
    const customerB = await createCustomer("markread-b");
    const admin = await createAdmin("markread-admin");
    const order = await placeOrder(customerA.id);
    await confirmOrder(order.id, admin.id);

    const notifications = await notificationService.listForUser(customerA.id);
    const target = notifications[0];
    expect(target.read).toBe(false);

    await expect(notificationService.markRead(target.id, customerB.id)).rejects.toThrow(
      NotificationNotFoundError
    );

    const updated = await notificationService.markRead(target.id, customerA.id);
    expect(updated.read).toBe(true);
    expect(updated.readAt).not.toBeNull();
  });

  it("markAllRead marks every unread notification for the caller read", async () => {
    const customer = await createCustomer("markall");
    const admin = await createAdmin("markall-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);
    await orderService.updateStatus(order.id, admin.id, "PROCESSING");

    const before = await notificationService.listForUser(customer.id);
    expect(before.some((n) => !n.read)).toBe(true);

    const result = await notificationService.markAllRead(customer.id);
    expect(result.count).toBeGreaterThanOrEqual(2);

    const after = await notificationService.listForUser(customer.id);
    expect(after.every((n) => n.read)).toBe(true);
  });
});
