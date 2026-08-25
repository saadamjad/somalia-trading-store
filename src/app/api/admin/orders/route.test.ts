import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
import { GET } from "./route";

// `requirePermission` itself is left un-mocked so these tests exercise the real
// session -> role -> permission lookup against the DB (same approach as
// src/server/auth/permissions.test.ts) — only `requireSession`'s underlying "who is
// calling" is faked, matching the pattern in src/app/api/orders/[id]/route.test.ts.
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
  const email = `phase9-admin-orders-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Orders Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Admin Orders Test ${label}`, role: roleName, mustChangePassword: false };
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `admin-orders-route-test-${label}-${runId}`,
      name: `Admin Orders Route Test Product (${label})`,
      description: "Test fixture product for admin orders route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "20.00",
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

describe("GET /api/admin/orders — permission enforcement", () => {
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

  it("rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET(makeRequest("http://localhost:3000/api/admin/orders"));
    expect(res.status).toBe(401);
  });

  it("rejects an authenticated customer (no orders.view permission) with 403, not just a hidden UI button", async () => {
    const customer = await createSessionForRole("no-perm", "customer");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/orders"));
    expect(res.status).toBe(403);
  });

  it("an admin with orders.view can list orders across customers", async () => {
    const admin = await createSessionForRole("has-perm", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const customer = await createSessionForRole("target-customer", "customer");
    const order = await placeOrder(customer.userId);

    const res = await GET(makeRequest("http://localhost:3000/api/admin/orders?pageSize=100"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.some((item: { id: string }) => item.id === order.id)).toBe(true);
  });

  it("filters by status via query params", async () => {
    const admin = await createSessionForRole("filter-admin", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await GET(
      makeRequest("http://localhost:3000/api/admin/orders?status=DELIVERED&pageSize=100")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.every((item: { status: string }) => item.status === "DELIVERED")).toBe(true);
  });
});
