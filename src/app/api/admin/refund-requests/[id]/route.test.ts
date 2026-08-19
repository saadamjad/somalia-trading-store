import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
import { refundRequestService } from "@/server/services/refund-request-service";
import { GET, PATCH } from "./route";

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

function patchJson(url: string, body: unknown) {
  return makeRequest(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase10-admin-refund-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Refund Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Admin Refund Route Test ${label}`, role: roleName };
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `admin-refund-route-test-${label}-${runId}`,
      name: `Admin Refund Route Test Product (${label})`,
      description: "Test fixture product for admin refund route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "22.00",
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

describe("/api/admin/refund-requests/[id]", () => {
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

  async function makeOpenRequest(labelPrefix: string) {
    const customer = await createSessionForRole(`${labelPrefix}-customer`, "customer");
    const admin = await createSessionForRole(`${labelPrefix}-admin`, "super_admin");
    const order = await placeOrder(customer.userId);
    await confirmOrder(order.id, admin.userId);
    const request = await refundRequestService.createForOwner(customer.userId, {
      orderId: order.id,
      reasonCategory: "DAMAGED",
    });
    return { customer, admin, order, request };
  }

  it("GET rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET(makeRequest("http://localhost:3000/api/admin/refund-requests/x"), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET rejects an authenticated customer (no refunds.view) with 403", async () => {
    const { customer, request } = await makeOpenRequest("get-403");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET(
      makeRequest(`http://localhost:3000/api/admin/refund-requests/${request.id}`),
      { params: Promise.resolve({ id: request.id }) }
    );
    expect(res.status).toBe(403);
  });

  it("PATCH rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await PATCH(
      patchJson("http://localhost:3000/api/admin/refund-requests/x", { status: "APPROVED" }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(401);
  });

  it("PATCH rejects a customer (no refunds.manage) with 403", async () => {
    const { customer, request } = await makeOpenRequest("patch-403");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await PATCH(
      patchJson(`http://localhost:3000/api/admin/refund-requests/${request.id}`, {
        status: "APPROVED",
      }),
      { params: Promise.resolve({ id: request.id }) }
    );
    expect(res.status).toBe(403);
  });

  it("HARD REQUIREMENT: PATCH approve by an admin with refunds.manage succeeds and does NOT change Order.paymentStatus", async () => {
    const { admin, order, request } = await makeOpenRequest("patch-approve-decoupling");

    vi.mocked(requireSession).mockResolvedValue(admin);
    const res = await PATCH(
      patchJson(`http://localhost:3000/api/admin/refund-requests/${request.id}`, {
        status: "APPROVED",
        adminNote: "Approved — sorry for the trouble.",
      }),
      { params: Promise.resolve({ id: request.id }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("APPROVED");
    expect(body.item.adminNote).toBe("Approved — sorry for the trouble.");

    const orderRow = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderRow.paymentStatus).toBe("NOT_PAID");
  });

  it("PATCH rejects an invalid status value with 400", async () => {
    const { admin, request } = await makeOpenRequest("patch-invalid");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await PATCH(
      patchJson(`http://localhost:3000/api/admin/refund-requests/${request.id}`, {
        status: "NOT_A_REAL_STATUS",
      }),
      { params: Promise.resolve({ id: request.id }) }
    );
    expect(res.status).toBe(400);
  });
});
