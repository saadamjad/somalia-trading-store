import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
import {
  refundRequestService,
  OrderNotFoundForRefundError,
  OrderNotEligibleForRefundError,
  RefundRequestAlreadyOpenError,
  RefundRequestNotFoundError,
  InvalidRefundStatusTransitionError,
} from "@/server/services/refund-request-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase10-refund-service-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Refund Service Test ${label}`,
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

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `refund-service-test-${label}-${runId}`,
      name: `Refund Service Test Product (${label})`,
      description: "Test fixture product for refund service tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "40.00",
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

/** Advances a freshly-created PENDING order to CONFIRMED (the minimum eligible state). */
async function confirmOrder(orderId: string, adminId: string) {
  await orderService.updateStatus(orderId, adminId, "CONFIRMED");
}

describe("refundRequestService", () => {
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

  it("creates a REQUESTED refund request for the owner's own eligible (CONFIRMED) order, seeded with an actor-less initial history row", async () => {
    const customer = await createCustomer("happy-path");
    const admin = await createAdmin("happy-path-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const request = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "DAMAGED",
      reasonDetail: "Box arrived crushed.",
    });

    expect(request.status).toBe("REQUESTED");
    expect(request.order.id).toBe(order.id);
    expect(request.reviewedBy).toBeNull();
    expect(request.statusHistory).toHaveLength(1);
    expect(request.statusHistory[0].fromStatus).toBeNull();
    expect(request.statusHistory[0].toStatus).toBe("REQUESTED");
    expect(request.statusHistory[0].actor).toBeNull();
  });

  it("IDOR: throws OrderNotFoundForRefundError (not a permission error) when the order belongs to another customer", async () => {
    const customerA = await createCustomer("idor-a");
    const customerB = await createCustomer("idor-b");
    const admin = await createAdmin("idor-admin");
    const bOrder = await placeOrder(customerB.id);
    await confirmOrder(bOrder.id, admin.id);

    await expect(
      refundRequestService.createForOwner(customerA.id, {
        orderId: bOrder.id,
        reasonCategory: "OTHER",
      })
    ).rejects.toThrow(OrderNotFoundForRefundError);
  });

  it("rejects a refund request for a still-PENDING order (customer should cancel instead)", async () => {
    const customer = await createCustomer("pending-reject");
    const order = await placeOrder(customer.id); // left PENDING — never confirmed

    await expect(
      refundRequestService.createForOwner(customer.id, {
        orderId: order.id,
        reasonCategory: "OTHER",
      })
    ).rejects.toThrow(OrderNotEligibleForRefundError);
  });

  it("rejects a refund request for a CANCELLED order", async () => {
    const customer = await createCustomer("cancelled-reject");
    const admin = await createAdmin("cancelled-reject-admin");
    const order = await placeOrder(customer.id);
    await orderService.updateStatus(order.id, admin.id, "CANCELLED");

    await expect(
      refundRequestService.createForOwner(customer.id, {
        orderId: order.id,
        reasonCategory: "OTHER",
      })
    ).rejects.toThrow(OrderNotEligibleForRefundError);
  });

  it("rejects creating a second refund request while one is already open (REQUESTED/UNDER_REVIEW) for the same order", async () => {
    const customer = await createCustomer("dup-reject");
    const admin = await createAdmin("dup-reject-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "DAMAGED",
    });

    await expect(
      refundRequestService.createForOwner(customer.id, {
        orderId: order.id,
        reasonCategory: "OTHER",
      })
    ).rejects.toThrow(RefundRequestAlreadyOpenError);
  });

  it("getOwned: IDOR-safe — a non-owner gets RefundRequestNotFoundError, not the data", async () => {
    const customer = await createCustomer("get-owned-owner");
    const stranger = await createCustomer("get-owned-stranger");
    const admin = await createAdmin("get-owned-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const request = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "OTHER",
    });

    await expect(refundRequestService.getOwned(request.id, stranger.id)).rejects.toThrow(
      RefundRequestNotFoundError
    );
    await expect(refundRequestService.getOwned(request.id, customer.id)).resolves.toMatchObject({
      id: request.id,
    });
  });

  it("HARD REQUIREMENT: admin approving a refund request does NOT change Order.paymentStatus, and records the transition with the correct actor/timestamp", async () => {
    const customer = await createCustomer("decoupling");
    const admin = await createAdmin("decoupling-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const before = await orderService.getOwned(order.id, customer.id);
    expect(before.paymentStatus).toBe("NOT_PAID");

    const request = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "DAMAGED",
      reasonDetail: "Cracked on arrival.",
    });

    const beforeApprove = new Date();
    const approved = await refundRequestService.updateStatus(
      request.id,
      admin.id,
      "APPROVED",
      "We're sorry — approved."
    );

    expect(approved.status).toBe("APPROVED");
    expect(approved.reviewedBy?.id).toBe(admin.id);
    expect(approved.reviewedAt).toBeTruthy();
    expect(new Date(approved.reviewedAt!).getTime()).toBeGreaterThanOrEqual(beforeApprove.getTime() - 1000);
    expect(approved.adminNote).toBe("We're sorry — approved.");

    // Full audit trail: two rows now — the initial REQUESTED and this APPROVED one.
    expect(approved.statusHistory).toHaveLength(2);
    const last = approved.statusHistory[approved.statusHistory.length - 1];
    expect(last.fromStatus).toBe("REQUESTED");
    expect(last.toStatus).toBe("APPROVED");
    expect(last.actor?.id).toBe(admin.id);

    // The core Phase 10 hard requirement: Order.paymentStatus is completely untouched.
    const after = await orderService.getOwned(order.id, customer.id);
    expect(after.paymentStatus).toBe("NOT_PAID");
    expect(after.status).toBe(before.status); // order.status also untouched by a refund decision

    // And its own payment status history is unaffected — only the initial row exists.
    const orderRow = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { paymentStatusHistory: true },
    });
    expect(orderRow.paymentStatusHistory).toHaveLength(1);
    expect(orderRow.paymentStatus).toBe("NOT_PAID");
  });

  it("admin rejecting a refund request also leaves Order.paymentStatus untouched", async () => {
    const customer = await createCustomer("reject-decoupling");
    const admin = await createAdmin("reject-decoupling-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const request = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "OTHER",
    });

    const rejected = await refundRequestService.updateStatus(
      request.id,
      admin.id,
      "REJECTED",
      "Outside the return window."
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.adminNote).toBe("Outside the return window.");

    const after = await orderService.getOwned(order.id, customer.id);
    expect(after.paymentStatus).toBe("NOT_PAID");
  });

  it("rejects an invalid transition out of a terminal status (APPROVED -> REJECTED)", async () => {
    const customer = await createCustomer("terminal");
    const admin = await createAdmin("terminal-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const request = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "OTHER",
    });
    await refundRequestService.updateStatus(request.id, admin.id, "APPROVED");

    await expect(
      refundRequestService.updateStatus(request.id, admin.id, "REJECTED")
    ).rejects.toThrow(InvalidRefundStatusTransitionError);
  });

  it("supports the optional UNDER_REVIEW intermediate state before a final decision", async () => {
    const customer = await createCustomer("under-review");
    const admin = await createAdmin("under-review-admin");
    const order = await placeOrder(customer.id);
    await confirmOrder(order.id, admin.id);

    const request = await refundRequestService.createForOwner(customer.id, {
      orderId: order.id,
      reasonCategory: "OTHER",
    });

    const underReview = await refundRequestService.updateStatus(request.id, admin.id, "UNDER_REVIEW");
    expect(underReview.status).toBe("UNDER_REVIEW");

    const approved = await refundRequestService.updateStatus(request.id, admin.id, "APPROVED");
    expect(approved.status).toBe("APPROVED");
    expect(approved.statusHistory).toHaveLength(3);
  });
});
