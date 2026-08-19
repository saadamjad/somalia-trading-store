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
});
