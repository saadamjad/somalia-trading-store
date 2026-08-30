import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
import {
  reviewService,
  ProductNotFoundForReviewError,
  ReviewAlreadyExistsError,
  ReviewNotFoundError,
} from "@/server/services/review-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `review-service-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Review Service Test ${label}`,
    email: uniqueEmail(label),
    password: "PlainTextPass1",
  });
}

async function createProduct(label: string, stock = 10) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `review-service-test-${label}-${runId}`,
      name: `Review Service Test Product (${label})`,
      description: "Test fixture product for review service tests.",
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

async function createAdmin(label: string) {
  const user = await createCustomer(label);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: "super_admin" } });
  await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  return user;
}

async function placeAndDeliverOrder(userId: string, adminId: string, productId: string) {
  const address = await addressService.create(userId, SAMPLE_ADDRESS);
  await cartService.setItem(userId, productId, 1);
  const order = await orderService.createOrder(userId, { addressId: address.id });
  await orderService.updateStatus(order.id, adminId, "CONFIRMED");
  await orderService.updateStatus(order.id, adminId, "PROCESSING");
  await orderService.updateStatus(order.id, adminId, "SHIPPED");
  await orderService.updateStatus(order.id, adminId, "DELIVERED");
  return order;
}

describe("reviewService", () => {
  afterAll(async () => {
    await prisma.review.deleteMany({ where: { user: { email: { in: testEmails } } } });
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

  it("creates a PENDING review with verifiedPurchase=false when the user has no delivered order for the product", async () => {
    const customer = await createCustomer("no-purchase");
    const productId = await createProduct("no-purchase");

    const review = await reviewService.create({
      productId,
      userId: customer.id,
      rating: 4,
      title: "Decent",
      body: "It works fine.",
    });

    expect(review.verifiedPurchase).toBe(false);

    const admin = await createAdmin("no-purchase-mod");
    const adminList = await reviewService.adminList({ page: 1, pageSize: 20 });
    const stored = adminList.items.find((r) => r.id === review.id)!;
    expect(stored.status).toBe("PENDING");
    void admin;
  });

  it("computes verifiedPurchase=true server-side when the reviewer has a DELIVERED order containing the product, ignoring any client-supplied value", async () => {
    const customer = await createCustomer("purchaser");
    const admin = await createAdmin("purchaser-admin");
    const productId = await createProduct("purchaser");
    await placeAndDeliverOrder(customer.id, admin.id, productId);

    const review = await reviewService.create({
      productId,
      userId: customer.id,
      rating: 5,
      body: "Exactly as described.",
    });

    expect(review.verifiedPurchase).toBe(true);
  });

  it("rejects a second review from the same user for the same product", async () => {
    const customer = await createCustomer("duplicate");
    const productId = await createProduct("duplicate");

    await reviewService.create({ productId, userId: customer.id, rating: 3, body: "Ok." });

    await expect(
      reviewService.create({ productId, userId: customer.id, rating: 1, body: "Changed my mind." })
    ).rejects.toThrow(ReviewAlreadyExistsError);
  });

  it("throws ProductNotFoundForReviewError for a non-existent product", async () => {
    const customer = await createCustomer("missing-product");

    await expect(
      reviewService.create({
        productId: "does-not-exist",
        userId: customer.id,
        rating: 3,
        body: "N/A",
      })
    ).rejects.toThrow(ProductNotFoundForReviewError);
  });

  it("only counts APPROVED reviews in the public listing and aggregate rating — PENDING/REJECTED are excluded", async () => {
    const customerA = await createCustomer("agg-a");
    const customerB = await createCustomer("agg-b");
    const productId = await createProduct("aggregate");

    const reviewA = await reviewService.create({
      productId,
      userId: customerA.id,
      rating: 5,
      body: "Great.",
    });
    await reviewService.create({ productId, userId: customerB.id, rating: 1, body: "Bad." });

    // Only approve reviewA — reviewB stays PENDING.
    await reviewService.updateStatus(reviewA.id, "APPROVED");

    const publicView = await reviewService.listApprovedForProduct(productId);
    expect(publicView.count).toBe(1);
    expect(publicView.averageRating).toBe(5);
    expect(publicView.items).toHaveLength(1);
    expect(publicView.items[0].id).toBe(reviewA.id);
  });

  it("admin can re-moderate (approve then reject) — moderation is not a terminal state machine", async () => {
    const customer = await createCustomer("remoderate");
    const productId = await createProduct("remoderate");
    const review = await reviewService.create({
      productId,
      userId: customer.id,
      rating: 3,
      body: "Middling.",
    });

    const approved = await reviewService.updateStatus(review.id, "APPROVED");
    expect(approved.status).toBe("APPROVED");

    const rejected = await reviewService.updateStatus(review.id, "REJECTED");
    expect(rejected.status).toBe("REJECTED");

    const publicView = await reviewService.listApprovedForProduct(productId);
    expect(publicView.items.find((r) => r.id === review.id)).toBeUndefined();
  });

  it("throws ReviewNotFoundError when moderating a non-existent review", async () => {
    await expect(reviewService.updateStatus("does-not-exist", "APPROVED")).rejects.toThrow(
      ReviewNotFoundError
    );
  });
});
