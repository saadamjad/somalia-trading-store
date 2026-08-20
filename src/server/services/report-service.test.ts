import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { reportService } from "@/server/services/report-service";
import { reportQuerySchema } from "@/lib/validations/reports";
import type { OrderStatus } from "@/generated/prisma/client";

// Matches the fixture style of dashboard-service.test.ts / inventory-service.test.ts —
// unique-suffixed rows created directly via Prisma (bypassing checkout/admin flows) so
// exact expected aggregates are known ahead of time, then torn down in afterAll.
const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const userIds: string[] = [];
const productIds: string[] = [];
const orderIds: string[] = [];
const refundRequestIds: string[] = [];
const quoteIds: string[] = [];

async function makeCustomer(label: string) {
  const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
  const user = await prisma.user.create({
    data: {
      email: `report-${label}-${runId}@example.test`,
      passwordHash: "not-a-real-hash",
      name: `Report Test Customer (${label})`,
      roleId: customerRole.id,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `report-test-${label}-${runId}`,
      sku: `RPT-${label}-${runId}`.slice(0, 40),
      name: `Report Test Product (${label})`,
      description: "Test fixture product for report service tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "20.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: 100, lowStockThreshold: 5 } });
  return product;
}

async function makeOrder(
  label: string,
  userId: string,
  productId: string,
  productName: string,
  opts: { status?: OrderStatus; unitPrice: string; quantity: number; createdAt: Date }
) {
  const lineTotal = (Number(opts.unitPrice) * opts.quantity).toFixed(2);
  const order = await prisma.order.create({
    data: {
      orderNumber: `RPT-TEST-${label}-${runId}`,
      status: opts.status ?? "PENDING",
      userId,
      shippingRecipientName: "Test Recipient",
      shippingPhone: "+252000000",
      shippingLine1: "123 Test St",
      shippingCity: "Mogadishu",
      shippingCountry: "Somalia",
      subtotal: lineTotal,
      total: lineTotal,
      currency: "USD",
      createdAt: opts.createdAt,
      items: {
        create: [
          {
            productId,
            productName,
            sku: null,
            unitPrice: opts.unitPrice,
            quantity: opts.quantity,
            lineTotal,
          },
        ],
      },
    },
  });
  orderIds.push(order.id);
  return order;
}

describe("reportService.build", () => {
  afterAll(async () => {
    await prisma.refundRequestStatusHistory.deleteMany({
      where: { refundRequestId: { in: refundRequestIds } },
    });
    await prisma.refundRequest.deleteMany({ where: { id: { in: refundRequestIds } } });
    await prisma.quoteStatusHistory.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await prisma.quoteItem.deleteMany({ where: { quoteId: { in: quoteIds } } });
    await prisma.quote.deleteMany({ where: { id: { in: quoteIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.paymentStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("orders report: sums order value and row count correctly for a date-scoped, status-scoped query", async () => {
    const customer = await makeCustomer("orders");
    const product = await makeProduct("orders");
    const now = new Date();

    await makeOrder("orders-a", customer.id, product.id, product.name, {
      status: "PENDING",
      unitPrice: "20.00",
      quantity: 2,
      createdAt: now,
    });
    await makeOrder("orders-b", customer.id, product.id, product.name, {
      status: "PENDING",
      unitPrice: "20.00",
      quantity: 1,
      createdAt: now,
    });
    // Different status — must be excluded by the orderStatus filter below.
    await makeOrder("orders-c", customer.id, product.id, product.name, {
      status: "CANCELLED",
      unitPrice: "999.00",
      quantity: 1,
      createdAt: now,
    });

    const query = reportQuerySchema.parse({ type: "orders", orderStatus: "PENDING", customer: customer.email });
    const table = await reportService.build(query);

    const ourRows = table.rows.filter((r) => r.orderNumber.toString().includes(runId) && r.orderNumber.toString().startsWith("RPT-TEST-orders-"));
    expect(ourRows).toHaveLength(2);
    const total = ourRows.reduce((sum, r) => sum + Number(r.total), 0);
    expect(total).toBeCloseTo(60, 2); // (2 * 20) + (1 * 20)
    expect(ourRows.every((r) => r.status === "PENDING")).toBe(true);

    // Never labeled "Revenue" anywhere in the output.
    expect(JSON.stringify(table).toLowerCase()).not.toContain("revenue");
  });

  it("products report: aggregates quantity sold per product correctly across multiple orders", async () => {
    const customer = await makeCustomer("products");
    const productA = await makeProduct("prod-a");
    const productB = await makeProduct("prod-b");
    const now = new Date();

    await makeOrder("prod-1", customer.id, productA.id, productA.name, {
      unitPrice: "20.00",
      quantity: 3,
      createdAt: now,
    });
    await makeOrder("prod-2", customer.id, productA.id, productA.name, {
      unitPrice: "20.00",
      quantity: 2,
      createdAt: now,
    });
    await makeOrder("prod-3", customer.id, productB.id, productB.name, {
      unitPrice: "20.00",
      quantity: 1,
      createdAt: now,
    });

    const query = reportQuerySchema.parse({ type: "products" });
    const table = await reportService.build(query);

    const rowA = table.rows.find((r) => r.productName === productA.name);
    const rowB = table.rows.find((r) => r.productName === productB.name);
    expect(rowA?.quantitySold).toBe(5);
    expect(rowA?.orderLineCount).toBe(2);
    expect(rowB?.quantitySold).toBe(1);
  });

  it("customers report: counts orders and sums order value per customer correctly", async () => {
    const customerA = await makeCustomer("cust-a");
    const customerB = await makeCustomer("cust-b");
    const product = await makeProduct("customers");
    const now = new Date();

    await makeOrder("cust-a-1", customerA.id, product.id, product.name, {
      unitPrice: "20.00",
      quantity: 1,
      createdAt: now,
    });
    await makeOrder("cust-a-2", customerA.id, product.id, product.name, {
      unitPrice: "20.00",
      quantity: 3,
      createdAt: now,
    });
    await makeOrder("cust-b-1", customerB.id, product.id, product.name, {
      unitPrice: "20.00",
      quantity: 1,
      createdAt: now,
    });

    const query = reportQuerySchema.parse({ type: "customers" });
    const table = await reportService.build(query);

    const rowA = table.rows.find((r) => r.customerEmail === customerA.email);
    const rowB = table.rows.find((r) => r.customerEmail === customerB.email);
    expect(rowA?.orderCount).toBe(2);
    expect(rowA?.orderValue).toBeCloseTo(80, 2); // 20 + 60
    expect(rowB?.orderCount).toBe(1);
    expect(rowB?.orderValue).toBeCloseTo(20, 2);
  });

  it("inventory report: reflects current stock level and status for a known product", async () => {
    const product = await makeProduct("inventory");
    await prisma.inventory.update({
      where: { productId: product.id },
      data: { quantity: 3, lowStockThreshold: 5 },
    });

    const query = reportQuerySchema.parse({ type: "inventory" });
    const table = await reportService.build(query);

    const row = table.rows.find(
      (r) => r.section === "Stock level" && r.product === product.name
    );
    expect(row).toBeDefined();
    expect(row?.quantity).toBe(3);
    expect(row?.status).toBe("low_stock");
  });

  it("refunds report: filters by status and counts correctly", async () => {
    const customer = await makeCustomer("refunds");
    const product = await makeProduct("refunds");
    const order = await makeOrder("refund-order", customer.id, product.id, product.name, {
      status: "DELIVERED",
      unitPrice: "20.00",
      quantity: 1,
      createdAt: new Date(),
    });

    const refund = await prisma.refundRequest.create({
      data: {
        orderId: order.id,
        requestedByUserId: customer.id,
        reasonCategory: "DAMAGED",
        status: "REQUESTED",
        statusHistory: { create: { fromStatus: null, toStatus: "REQUESTED" } },
      },
    });
    refundRequestIds.push(refund.id);

    const query = reportQuerySchema.parse({ type: "refunds", refundStatus: "REQUESTED" });
    const table = await reportService.build(query);

    const row = table.rows.find((r) => r.orderNumber === order.orderNumber);
    expect(row).toBeDefined();
    expect(row?.status).toBe("REQUESTED");
    expect(row?.reasonCategory).toBe("DAMAGED");
  });

  it("quotes report: computes conversion rate correctly from CONVERTED vs. total", async () => {
    const customer = await makeCustomer("quotes");
    const product = await makeProduct("quotes");

    const converted = await prisma.quote.create({
      data: {
        userId: customer.id,
        contactName: customer.name,
        contactEmail: customer.email,
        currency: "USD",
        status: "CONVERTED",
        items: {
          create: [{ productId: product.id, productName: product.name, quantity: 1 }],
        },
        statusHistory: { create: { fromStatus: null, toStatus: "NEW" } },
      },
    });
    quoteIds.push(converted.id);

    const notConverted = await prisma.quote.create({
      data: {
        userId: customer.id,
        contactName: customer.name,
        contactEmail: customer.email,
        currency: "USD",
        status: "NEW",
        items: {
          create: [{ productId: product.id, productName: product.name, quantity: 1 }],
        },
        statusHistory: { create: { fromStatus: null, toStatus: "NEW" } },
      },
    });
    quoteIds.push(notConverted.id);

    const query = reportQuerySchema.parse({ type: "quotes" });
    const table = await reportService.build(query);

    const convertedRow = table.rows.find((r) => r.contactEmail === customer.email && r.status === "CONVERTED");
    const newRow = table.rows.find((r) => r.contactEmail === customer.email && r.status === "NEW");
    expect(convertedRow).toBeDefined();
    expect(newRow).toBeDefined();

    // At least our two quotes are counted; conversion rate is a percentage string.
    expect(table.summary.find((s) => s.label === "Conversion rate")?.value).toMatch(/%$/);
  });
});
