import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import { cartService } from "@/server/services/cart-service";
import { orderService } from "@/server/services/order-service";
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

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];
const roleNames: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase9-admin-order-id-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Order Id Test ${label}`,
    email,
    password: "PlainTextPass1",
  });

  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }

  return { userId: user.id, email: user.email, name: `Admin Order Id Test ${label}`, role: roleName, mustChangePassword: false };
}

/** A role with `orders.view` but NOT `orders.update` — for a stricter 403 check on PATCH. */
async function createViewOnlyRole() {
  const roleName = `order_viewer_${runId}`;
  roleNames.push(roleName);
  const role = await prisma.role.create({ data: { name: roleName } });
  const permission = await prisma.permission.findUniqueOrThrow({ where: { key: "orders.view" } });
  await prisma.rolePermission.create({
    data: { roleId: role.id, permissionId: permission.id },
  });
  return roleName;
}

async function createProduct(label: string, stock: number) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `admin-order-id-route-test-${label}-${runId}`,
      name: `Admin Order Id Route Test Product (${label})`,
      description: "Test fixture product for admin order [id] route tests.",
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

async function placeOrder(userId: string) {
  const address = await addressService.create(userId, SAMPLE_ADDRESS);
  const productId = await createProduct(`for-${userId}`, 10);
  await cartService.setItem(userId, productId, 1);
  return orderService.createOrder(userId, { addressId: address.id });
}

describe("/api/admin/orders/[id]", () => {
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
    for (const roleName of roleNames) {
      await prisma.rolePermission.deleteMany({ where: { role: { name: roleName } } });
      await prisma.role.deleteMany({ where: { name: roleName } });
    }
    await prisma.$disconnect();
  });

  describe("GET", () => {
    it("rejects an unauthenticated request with 401", async () => {
      vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
      const res = await GET(makeRequest("http://localhost:3000/api/admin/orders/x"), {
        params: Promise.resolve({ id: "x" }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects a customer without orders.view with 403", async () => {
      const customer = await createSessionForRole("get-no-perm", "customer");
      vi.mocked(requireSession).mockResolvedValue(customer);

      const res = await GET(makeRequest("http://localhost:3000/api/admin/orders/x"), {
        params: Promise.resolve({ id: "x" }),
      });
      expect(res.status).toBe(403);
    });

    it("an admin can view any customer's order (no ownership scoping)", async () => {
      const customer = await createSessionForRole("get-target", "customer");
      const order = await placeOrder(customer.userId);

      const admin = await createSessionForRole("get-admin", "super_admin");
      vi.mocked(requireSession).mockResolvedValue(admin);

      const res = await GET(makeRequest(`http://localhost:3000/api/admin/orders/${order.id}`), {
        params: Promise.resolve({ id: order.id }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.item.id).toBe(order.id);
      expect(body.item.customer.id).toBe(customer.userId);
    });
  });

  describe("PATCH", () => {
    it("rejects an unauthenticated status-update request with 401 and makes no change", async () => {
      const customer = await createSessionForRole("patch-unauth-target", "customer");
      const order = await placeOrder(customer.userId);

      vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
      const res = await PATCH(
        makeRequest(`http://localhost:3000/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(401);

      const unchanged = await orderService.getOwned(order.id, customer.userId);
      expect(unchanged.status).toBe("PENDING");
    });

    it("rejects a user with orders.view but NOT orders.update with 403, and makes no change", async () => {
      const viewOnlyRoleName = await createViewOnlyRole();
      const viewer = await createSessionForRole("patch-view-only", viewOnlyRoleName);

      const customer = await createSessionForRole("patch-view-only-target", "customer");
      const order = await placeOrder(customer.userId);

      vi.mocked(requireSession).mockResolvedValue(viewer);
      const res = await PATCH(
        makeRequest(`http://localhost:3000/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED" }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(403);

      const unchanged = await orderService.getOwned(order.id, customer.userId);
      expect(unchanged.status).toBe("PENDING");
    });

    it("an admin with orders.update can move status forward; the change is recorded in OrderStatusHistory with correct actor/from/to, and paymentStatus never changes", async () => {
      const customer = await createSessionForRole("patch-happy-target", "customer");
      const order = await placeOrder(customer.userId);

      const admin = await createSessionForRole("patch-happy-admin", "super_admin");
      vi.mocked(requireSession).mockResolvedValue(admin);

      const res = await PATCH(
        makeRequest(`http://localhost:3000/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CONFIRMED", note: "Payment arranged offline." }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.item.status).toBe("CONFIRMED");
      expect(body.item.paymentStatus).toBe("NOT_PAID");

      const historyRow = body.item.statusHistory.find(
        (h: { fromStatus: string | null; toStatus: string }) =>
          h.fromStatus === "PENDING" && h.toStatus === "CONFIRMED"
      );
      expect(historyRow).toBeTruthy();
      expect(historyRow.actor.id).toBe(admin.userId);
      expect(historyRow.note).toBe("Payment arranged offline.");
    });

    it("rejects an invalid transition (e.g. PENDING -> DELIVERED) with a 400 and a clear error, making no change", async () => {
      const customer = await createSessionForRole("patch-invalid-target", "customer");
      const order = await placeOrder(customer.userId);

      const admin = await createSessionForRole("patch-invalid-admin", "super_admin");
      vi.mocked(requireSession).mockResolvedValue(admin);

      const res = await PATCH(
        makeRequest(`http://localhost:3000/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "DELIVERED" }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(typeof body.error).toBe("string");

      const unchanged = await orderService.getOwned(order.id, customer.userId);
      expect(unchanged.status).toBe("PENDING");
    });

    it("updates the internal note without requiring or affecting status", async () => {
      const customer = await createSessionForRole("patch-note-target", "customer");
      const order = await placeOrder(customer.userId);

      const admin = await createSessionForRole("patch-note-admin", "super_admin");
      vi.mocked(requireSession).mockResolvedValue(admin);

      const res = await PATCH(
        makeRequest(`http://localhost:3000/api/admin/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ internalNote: "Called customer to confirm address." }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.item.internalNote).toBe("Called customer to confirm address.");
      expect(body.item.status).toBe("PENDING");
    });
  });
});
