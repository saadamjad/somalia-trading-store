import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { cartService } from "@/server/services/cart-service";
import { addressService } from "@/server/services/address-service";
import {
  orderService,
  EmptyCartError,
  StockUnavailableError,
  OrderNotFoundError,
  InvalidStatusTransitionError,
  EmailBelongsToExistingAccountError,
} from "@/server/services/order-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase8-order-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Order Test ${label}`,
    email: uniqueEmail(label),
    password: "PlainTextPass1",
  });
}

async function createProduct(label: string, stock: number, price = "10.00") {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `order-test-${label}-${runId}`,
      sku: `SKU-${label}-${runId}`,
      name: `Order Test Product (${label})`,
      description: "Test fixture product for order service tests.",
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

describe("orderService.createOrder", () => {
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

  it("happy path: creates a PENDING/NOT_PAID order with correct snapshots, decrements inventory, and clears the cart", async () => {
    const user = await createCustomer("happy-path");
    const address = await addressService.create(user.id, SAMPLE_ADDRESS);
    const productA = await createProduct("happy-a", 10, "25.50");
    const productB = await createProduct("happy-b", 5, "9.99");

    await cartService.setItem(user.id, productA, 2);
    await cartService.setItem(user.id, productB, 3);

    const order = await orderService.createOrder(user.id, { addressId: address.id });

    // Status/payment: hard requirement — always PENDING/NOT_PAID, never anything else.
    expect(order.status).toBe("PENDING");
    expect(order.paymentStatus).toBe("NOT_PAID");
    expect(order.orderNumber).toBeTruthy();

    // Snapshotted item data, independent of live Product rows.
    expect(order.items).toHaveLength(2);
    const itemA = order.items.find((i) => i.productId === productA)!;
    const itemB = order.items.find((i) => i.productId === productB)!;
    expect(itemA.unitPrice).toBe(25.5);
    expect(itemA.quantity).toBe(2);
    expect(itemA.lineTotal).toBe(51);
    expect(itemB.unitPrice).toBe(9.99);
    expect(itemB.quantity).toBe(3);
    expect(itemB.lineTotal).toBeCloseTo(29.97, 2);
    expect(order.subtotal).toBeCloseTo(80.97, 2);
    expect(order.total).toBe(order.subtotal);

    // Shipping snapshot copied from the address, not a live FK.
    expect(order.shipping.recipientName).toBe(SAMPLE_ADDRESS.recipientName);
    expect(order.shipping.city).toBe(SAMPLE_ADDRESS.city);

    // Inventory decremented by exactly the ordered quantities.
    const invA = await prisma.inventory.findUniqueOrThrow({ where: { productId: productA } });
    const invB = await prisma.inventory.findUniqueOrThrow({ where: { productId: productB } });
    expect(invA.quantity).toBe(8);
    expect(invB.quantity).toBe(2);

    const txA = await prisma.inventoryTransaction.findFirst({
      where: { productId: productA, reason: "ORDER_PLACED" },
    });
    expect(txA).not.toBeNull();
    expect(txA!.adjustment).toBe(-2);

    // Cart cleared only after the order actually persisted.
    const remainingCartItems = await cartService.getCartForUser(user.id);
    expect(remainingCartItems).toHaveLength(0);
  });

  it("rejects an empty cart without creating an order", async () => {
    const user = await createCustomer("empty-cart");
    const address = await addressService.create(user.id, SAMPLE_ADDRESS);

    await expect(orderService.createOrder(user.id, { addressId: address.id })).rejects.toThrow(
      EmptyCartError
    );

    const orders = await orderService.listForUser(user.id);
    expect(orders).toHaveLength(0);
  });

  it("insufficient stock: rejects the whole order, creates NO order, decrements NO inventory, and does NOT clear the cart", async () => {
    const user = await createCustomer("insufficient-stock");
    const address = await addressService.create(user.id, SAMPLE_ADDRESS);
    const productId = await createProduct("insufficient", 3);

    await cartService.setItem(user.id, productId, 10);

    await expect(orderService.createOrder(user.id, { addressId: address.id })).rejects.toThrow(
      StockUnavailableError
    );

    // No partial order.
    const orders = await orderService.listForUser(user.id);
    expect(orders).toHaveLength(0);

    // Inventory untouched.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(inventory.quantity).toBe(3);
    const transactionCount = await prisma.inventoryTransaction.count({ where: { productId } });
    expect(transactionCount).toBe(0);

    // Cart NOT cleared.
    const cartItems = await cartService.getCartForUser(user.id);
    expect(cartItems).toHaveLength(1);
    expect(cartItems[0].quantity).toBe(10);
  });

  it("a stock shortfall discovered at the transaction boundary (a genuine race) rolls back atomically: exactly one of two concurrent orders for the last unit succeeds, and no partial state is left by the loser", async () => {
    const buyerA = await createCustomer("race-a");
    const buyerB = await createCustomer("race-b");
    const addressA = await addressService.create(buyerA.id, SAMPLE_ADDRESS);
    const addressB = await addressService.create(buyerB.id, SAMPLE_ADDRESS);
    // Exactly enough stock for ONE of the two orders below.
    const productId = await createProduct("race", 1);

    await cartService.setItem(buyerA.id, productId, 1);
    await cartService.setItem(buyerB.id, productId, 1);

    const results = await Promise.allSettled([
      orderService.createOrder(buyerA.id, { addressId: addressA.id }),
      orderService.createOrder(buyerB.id, { addressId: addressB.id }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Stock ends at exactly 0 — not negative, not still 1.
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(inventory.quantity).toBe(0);

    // Exactly one order exists across both buyers.
    const ordersA = await orderService.listForUser(buyerA.id);
    const ordersB = await orderService.listForUser(buyerB.id);
    expect(ordersA.length + ordersB.length).toBe(1);

    // The losing buyer's cart was never cleared.
    const loserCart =
      ordersA.length === 0
        ? await cartService.getCartForUser(buyerA.id)
        : await cartService.getCartForUser(buyerB.id);
    expect(loserCart).toHaveLength(1);
  });

  it("never accepts client-supplied price/quantity: order pricing always comes from the server-side cart re-priced against current Product rows, not from any request field", async () => {
    const user = await createCustomer("no-client-price");
    const address = await addressService.create(user.id, SAMPLE_ADDRESS);
    const productId = await createProduct("no-client-price", 10, "42.00");

    await cartService.setItem(user.id, productId, 1);

    // The order-creation input type (OrderCreateInput, src/lib/validations/order.ts)
    // has no price/quantity/product fields at all — there is nothing to "ignore" here,
    // which is the point. Passing extraneous fields anyway (as an untyped payload,
    // simulating a malicious client) must have no effect on the resulting order.
    const maliciousInput = {
      addressId: address.id,
      items: [{ productId, unitPrice: 0.01, quantity: 999 }],
      total: 0.01,
    };

    const order = await orderService.createOrder(user.id, maliciousInput);

    expect(order.items).toHaveLength(1);
    expect(order.items[0].unitPrice).toBe(42);
    expect(order.items[0].quantity).toBe(1);
    expect(order.total).toBe(42);
  });

  it("a product's price change after an order was placed does not alter the historical order's snapshotted price/total", async () => {
    const user = await createCustomer("price-immutability");
    const address = await addressService.create(user.id, SAMPLE_ADDRESS);
    const productId = await createProduct("price-immutability", 10, "100.00");

    await cartService.setItem(user.id, productId, 1);
    const order = await orderService.createOrder(user.id, { addressId: address.id });
    expect(order.items[0].unitPrice).toBe(100);
    expect(order.total).toBe(100);

    // Price changes on the live Product row after the order was placed.
    await prisma.product.update({ where: { id: productId }, data: { price: "500.00" } });

    const reloaded = await orderService.getOwned(order.id, user.id);
    expect(reloaded.items[0].unitPrice).toBe(100);
    expect(reloaded.total).toBe(100);
  });

  it("creates a valid order from an inline (non-saved) shipping address", async () => {
    const user = await createCustomer("inline-address");
    const productId = await createProduct("inline-address", 5);
    await cartService.setItem(user.id, productId, 1);

    const order = await orderService.createOrder(user.id, {
      shippingAddress: SAMPLE_ADDRESS,
    });

    expect(order.shipping.recipientName).toBe(SAMPLE_ADDRESS.recipientName);
  });

  describe("IDOR: getOwned", () => {
    it("customer A cannot view customer B's order by id", async () => {
      const buyerA = await createCustomer("idor-a");
      const buyerB = await createCustomer("idor-b");
      const addressB = await addressService.create(buyerB.id, SAMPLE_ADDRESS);
      const productId = await createProduct("idor", 5);

      await cartService.setItem(buyerB.id, productId, 1);
      const order = await orderService.createOrder(buyerB.id, { addressId: addressB.id });

      await expect(orderService.getOwned(order.id, buyerA.id)).rejects.toThrow(
        OrderNotFoundError
      );

      // B can still see their own order.
      const own = await orderService.getOwned(order.id, buyerB.id);
      expect(own.id).toBe(order.id);
    });
  });

  describe("updateStatus", () => {
    it("records the change in OrderStatusHistory with correct actor/from/to, and leaves paymentStatus untouched", async () => {
      const customer = await createCustomer("status-happy");
      const admin = await createCustomer("status-happy-admin");
      const address = await addressService.create(customer.id, SAMPLE_ADDRESS);
      const productId = await createProduct("status-happy", 5);
      await cartService.setItem(customer.id, productId, 1);
      const order = await orderService.createOrder(customer.id, { addressId: address.id });

      expect(order.status).toBe("PENDING");
      expect(order.paymentStatus).toBe("NOT_PAID");

      const updated = await orderService.updateStatus(order.id, admin.id, "CONFIRMED", "Verified stock.");

      expect(updated.status).toBe("CONFIRMED");
      // Hard requirement: paymentStatus never moves as a side effect of a status update.
      expect(updated.paymentStatus).toBe("NOT_PAID");

      const historyRow = updated.statusHistory.find(
        (h) => h.fromStatus === "PENDING" && h.toStatus === "CONFIRMED"
      );
      expect(historyRow).toBeTruthy();
      expect(historyRow!.note).toBe("Verified stock.");
      expect(historyRow!.actor).not.toBeNull();
      expect(historyRow!.actor!.id).toBe(admin.id);

      // paymentStatusHistory is untouched by a status update — only the initial
      // system-authored NOT_PAID row exists.
      expect(updated.paymentStatusHistory).toHaveLength(1);
      expect(updated.paymentStatusHistory[0].toStatus).toBe("NOT_PAID");
      expect(updated.paymentStatusHistory[0].actor).toBeNull();
    });

    it("status and payment status update independently: several status transitions never change paymentStatus, since no code path here can", async () => {
      const customer = await createCustomer("decoupling");
      const admin = await createCustomer("decoupling-admin");
      const address = await addressService.create(customer.id, SAMPLE_ADDRESS);
      const productId = await createProduct("decoupling", 5);
      await cartService.setItem(customer.id, productId, 1);
      const order = await orderService.createOrder(customer.id, { addressId: address.id });

      const transitions: Array<"CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED"> = [
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
      ];

      let current = order;
      for (const nextStatus of transitions) {
        current = await orderService.updateStatus(current.id, admin.id, nextStatus);
        expect(current.status).toBe(nextStatus);
        expect(current.paymentStatus).toBe("NOT_PAID");
      }

      // Re-fetch independently to confirm persisted state, not just the in-memory return value.
      const reloaded = await orderService.adminGetById(order.id);
      expect(reloaded.status).toBe("DELIVERED");
      expect(reloaded.paymentStatus).toBe("NOT_PAID");
      expect(reloaded.statusHistory).toHaveLength(1 + transitions.length); // initial PENDING row + 4 transitions
    });

    it("rejects an invalid/nonsensical transition (skipping ahead) with InvalidStatusTransitionError, and does not modify the order", async () => {
      const customer = await createCustomer("invalid-transition");
      const admin = await createCustomer("invalid-transition-admin");
      const address = await addressService.create(customer.id, SAMPLE_ADDRESS);
      const productId = await createProduct("invalid-transition", 5);
      await cartService.setItem(customer.id, productId, 1);
      const order = await orderService.createOrder(customer.id, { addressId: address.id });

      // PENDING -> DELIVERED skips CONFIRMED/PROCESSING/SHIPPED entirely.
      await expect(
        orderService.updateStatus(order.id, admin.id, "DELIVERED")
      ).rejects.toThrow(InvalidStatusTransitionError);

      const unchanged = await orderService.adminGetById(order.id);
      expect(unchanged.status).toBe("PENDING");
      expect(unchanged.statusHistory).toHaveLength(1);
    });

    it("rejects moving backward out of a terminal status (CANCELLED)", async () => {
      const customer = await createCustomer("terminal-transition");
      const admin = await createCustomer("terminal-transition-admin");
      const address = await addressService.create(customer.id, SAMPLE_ADDRESS);
      const productId = await createProduct("terminal-transition", 5);
      await cartService.setItem(customer.id, productId, 1);
      const order = await orderService.createOrder(customer.id, { addressId: address.id });

      const cancelled = await orderService.updateStatus(order.id, admin.id, "CANCELLED");
      expect(cancelled.status).toBe("CANCELLED");

      await expect(
        orderService.updateStatus(order.id, admin.id, "CONFIRMED")
      ).rejects.toThrow(InvalidStatusTransitionError);
    });
  });

  describe("adminList", () => {
    it("filters by status and searches by order number / customer, independent of any one customer's ownership", async () => {
      const customer = await createCustomer("admin-list");
      const address = await addressService.create(customer.id, SAMPLE_ADDRESS);
      const productId = await createProduct("admin-list", 5);
      await cartService.setItem(customer.id, productId, 1);
      const order = await orderService.createOrder(customer.id, { addressId: address.id });

      const byOrderNumber = await orderService.adminList({
        orderNumber: order.orderNumber,
        sortBy: "createdAt",
        sortDir: "desc",
        page: 1,
        pageSize: 20,
      });
      expect(byOrderNumber.items.map((i) => i.id)).toContain(order.id);

      const byStatus = await orderService.adminList({
        status: "PENDING",
        sortBy: "createdAt",
        sortDir: "desc",
        page: 1,
        pageSize: 20,
      });
      expect(byStatus.items.some((i) => i.id === order.id)).toBe(true);

      const byWrongStatus = await orderService.adminList({
        status: "DELIVERED",
        sortBy: "createdAt",
        sortDir: "desc",
        page: 1,
        pageSize: 20,
      });
      expect(byWrongStatus.items.some((i) => i.id === order.id)).toBe(false);
    });
  });

  describe("createGuestOrder", () => {
    it("creates a PENDING/NOT_PAID order and a password-less isGuest User for a brand-new email", async () => {
      const productId = await createProduct("guest-new", 5);
      const email = uniqueEmail("guest-new");

      const order = await orderService.createGuestOrder({
        name: "Guest Buyer",
        email,
        shippingAddress: SAMPLE_ADDRESS,
        items: [{ productId, quantity: 2 }],
      });

      expect(order.status).toBe("PENDING");
      expect(order.paymentStatus).toBe("NOT_PAID");

      const user = await prisma.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
      expect(user.isGuest).toBe(true);
      expect(user.passwordHash).toBeNull();
    });

    it("reuses the same guest User (no duplicate account) on a second order from the same email", async () => {
      const productId = await createProduct("guest-repeat", 5);
      const email = uniqueEmail("guest-repeat");

      const first = await orderService.createGuestOrder({
        name: "Guest Buyer",
        email,
        shippingAddress: SAMPLE_ADDRESS,
        items: [{ productId, quantity: 1 }],
      });
      const second = await orderService.createGuestOrder({
        name: "Guest Buyer",
        email,
        shippingAddress: SAMPLE_ADDRESS,
        items: [{ productId, quantity: 1 }],
      });

      const firstOrder = await prisma.order.findUniqueOrThrow({ where: { id: first.id } });
      const secondOrder = await prisma.order.findUniqueOrThrow({ where: { id: second.id } });
      expect(secondOrder.userId).toBe(firstOrder.userId);
    });

    it("rejects guest checkout when the email belongs to an existing REAL (non-guest) account", async () => {
      const customer = await createCustomer("guest-collision");
      const productId = await createProduct("guest-collision", 5);

      await expect(
        orderService.createGuestOrder({
          name: "Impersonator",
          email: customer.email,
          shippingAddress: SAMPLE_ADDRESS,
          items: [{ productId, quantity: 1 }],
        })
      ).rejects.toThrow(EmailBelongsToExistingAccountError);
    });

    it("dedupes a duplicated productId in items by summing quantity into one order line", async () => {
      const productId = await createProduct("guest-dedupe", 10, "5.00");
      const email = uniqueEmail("guest-dedupe");

      const order = await orderService.createGuestOrder({
        name: "Guest Buyer",
        email,
        shippingAddress: SAMPLE_ADDRESS,
        items: [
          { productId, quantity: 2 },
          { productId, quantity: 3 },
        ],
      });

      const stored = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      expect(stored.items).toHaveLength(1);
      expect(stored.items[0]!.quantity).toBe(5);
      expect(Number(stored.items[0]!.lineTotal)).toBe(25);
    });
  });
});
