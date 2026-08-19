import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { addressService } from "@/server/services/address-service";
import {
  quoteService,
  QuoteNotFoundError,
  QuoteNotConvertibleError,
  QuoteMissingUserForConversionError,
  InvalidQuoteStatusTransitionError,
} from "@/server/services/quote-service";
import { StockUnavailableError } from "@/server/services/order-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase11-quote-service-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Quote Service Test ${label}`,
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
      slug: `quote-service-test-${label}-${runId}`,
      sku: `QST-${label}-${runId}`,
      name: `Quote Service Test Product (${label})`,
      description: "Test fixture product for quote service tests.",
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

describe("quoteService", () => {
  afterAll(async () => {
    await prisma.orderItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.order.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.quoteStatusHistory.deleteMany({ where: { quote: { contactEmail: { in: testEmails } } } });
    await prisma.quoteItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.quote.deleteMany({ where: { contactEmail: { in: testEmails } } });
    await prisma.inventoryTransaction.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.address.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("lets a guest (no userId) submit a quote request, creating a NEW Quote + QuoteItems", async () => {
    const productId = await createProduct("guest-submit", 10);
    const guestEmail = uniqueEmail("guest-contact");

    const quote = await quoteService.submit(null, {
      name: "Guest Buyer",
      email: guestEmail,
      items: [{ productId, quantity: 5 }],
    });

    expect(quote.status).toBe("NEW");
    expect(quote.user).toBeNull();
    expect(quote.contact.email).toBe(guestEmail);
    expect(quote.items).toHaveLength(1);
    expect(quote.items[0].quantity).toBe(5);
    expect(quote.items[0].quotedUnitPrice).toBeNull();

    const stored = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
    expect(stored.userId).toBeNull();
    expect(stored.status).toBe("NEW");
  });

  it("attaches userId when a logged-in customer submits a quote", async () => {
    const customer = await createCustomer("logged-in-submit");
    const productId = await createProduct("logged-in-submit", 10);

    const quote = await quoteService.submit(customer.id, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 2 }],
    });

    expect(quote.user?.id).toBe(customer.id);

    const own = await quoteService.getOwned(quote.id, customer.id);
    expect(own.id).toBe(quote.id);
  });

  it("scopes listForUser/getOwned to the caller's own quotes (IDOR)", async () => {
    const customerA = await createCustomer("idor-a");
    const customerB = await createCustomer("idor-b");
    const productId = await createProduct("idor", 10);

    const quote = await quoteService.submit(customerA.id, {
      name: customerA.name,
      email: customerA.email,
      items: [{ productId, quantity: 1 }],
    });

    const listA = await quoteService.listForUser(customerA.id);
    expect(listA.some((q) => q.id === quote.id)).toBe(true);

    const listB = await quoteService.listForUser(customerB.id);
    expect(listB.some((q) => q.id === quote.id)).toBe(false);

    await expect(quoteService.getOwned(quote.id, customerB.id)).rejects.toThrow(QuoteNotFoundError);
  });

  it("admin respond() sets quotedUnitPrice per item and moves the quote to QUOTED", async () => {
    const customer = await createCustomer("respond-customer");
    const admin = await createAdmin("respond-admin");
    const productId = await createProduct("respond", 10, "30.00");

    const quote = await quoteService.submit(customer.id, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 3 }],
    });

    const responded = await quoteService.respond(quote.id, admin.id, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: 27.5 }],
      adminNote: "Bulk discount applied.",
    });

    expect(responded.status).toBe("QUOTED");
    expect(responded.items[0].quotedUnitPrice).toBe(27.5);
    expect(responded.adminNote).toBe("Bulk discount applied.");
  });

  it("rejects respond() from a terminal status via the transitions map", async () => {
    const customer = await createCustomer("bad-transition");
    const admin = await createAdmin("bad-transition-admin");
    const productId = await createProduct("bad-transition", 10);

    const quote = await quoteService.submit(customer.id, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 1 }],
    });

    await quoteService.adminUpdateStatus(quote.id, admin.id, "DECLINED");

    await expect(
      quoteService.respond(quote.id, admin.id, {
        items: [{ id: quote.items[0].id, quotedUnitPrice: 10 }],
      })
    ).rejects.toThrow(InvalidQuoteStatusTransitionError);
  });

  async function buildAcceptedQuote(label: string, stock: number, unitPrice: number) {
    const customer = await createCustomer(`${label}-customer`);
    const admin = await createAdmin(`${label}-admin`);
    const productId = await createProduct(label, stock, "50.00");
    await addressService.create(customer.id, SAMPLE_ADDRESS);

    const quote = await quoteService.submit(customer.id, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 4 }],
    });

    const responded = await quoteService.respond(quote.id, admin.id, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: unitPrice }],
    });

    await quoteService.customerUpdateStatus(quote.id, customer.id, "ACCEPTED");

    return { customer, admin, productId, quoteId: quote.id, respondedItemId: responded.items[0].id };
  }

  it("customerUpdateStatus lets the owning customer accept a QUOTED quote, but not another customer's", async () => {
    const { customer, quoteId } = await buildAcceptedQuote("customer-accept", 10, 45);
    const accepted = await quoteService.getOwned(quoteId, customer.id);
    expect(accepted.status).toBe("ACCEPTED");

    const otherCustomer = await createCustomer("customer-accept-other");
    await expect(
      quoteService.customerUpdateStatus(quoteId, otherCustomer.id, "ACCEPTED")
    ).rejects.toThrow(QuoteNotFoundError);
  });

  it("convertToOrder creates a real Order priced at the QUOTED price (not the live product price), decrements stock via the normal inventory path, and moves the quote to CONVERTED", async () => {
    const unitPrice = 42.5; // deliberately different from the product's live price (50.00)
    const { customer, admin, productId, quoteId } = await buildAcceptedQuote("convert-happy", 20, unitPrice);

    const beforeInventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });

    const address = await addressService.listForUser(customer.id);
    const result = await quoteService.convertToOrder(quoteId, admin.id, {
      addressId: address[0].id,
    });

    expect(result.quote.status).toBe("CONVERTED");
    expect(result.quote.convertedOrder?.id).toBe(result.order.id);

    expect(result.order.status).toBe("PENDING");
    expect(result.order.paymentStatus).toBe("NOT_PAID");
    expect(result.order.items).toHaveLength(1);
    expect(result.order.items[0].unitPrice).toBe(unitPrice);
    expect(result.order.items[0].quantity).toBe(4);
    expect(result.order.items[0].lineTotal).toBeCloseTo(unitPrice * 4, 2);

    const storedQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(storedQuote.status).toBe("CONVERTED");
    expect(storedQuote.convertedOrderId).toBe(result.order.id);

    const afterInventory = await prisma.inventory.findUniqueOrThrow({ where: { productId } });
    expect(afterInventory.quantity).toBe(beforeInventory.quantity - 4);

    const decrementTx = await prisma.inventoryTransaction.findFirst({
      where: { productId, reason: "ORDER_PLACED", adjustment: -4 },
      orderBy: { createdAt: "desc" },
    });
    expect(decrementTx).not.toBeNull();
  });

  it("rejects conversion if current stock no longer covers the quoted quantity, even though the quote was ACCEPTED", async () => {
    const { admin, productId, quoteId, customer } = await buildAcceptedQuote("convert-stock", 2, 40);

    // Stock drops below the quoted quantity (4) after acceptance — e.g. sold elsewhere.
    await prisma.inventory.update({ where: { productId }, data: { quantity: 1 } });

    const address = await addressService.listForUser(customer.id);
    await expect(
      quoteService.convertToOrder(quoteId, admin.id, { addressId: address[0].id })
    ).rejects.toThrow(StockUnavailableError);

    const storedQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    expect(storedQuote.status).toBe("ACCEPTED");
    expect(storedQuote.convertedOrderId).toBeNull();
  });

  it("rejects conversion of a quote that isn't ACCEPTED", async () => {
    const customer = await createCustomer("convert-not-accepted");
    const admin = await createAdmin("convert-not-accepted-admin");
    const productId = await createProduct("convert-not-accepted", 10);

    const quote = await quoteService.submit(customer.id, {
      name: customer.name,
      email: customer.email,
      items: [{ productId, quantity: 1 }],
    });

    await expect(
      quoteService.convertToOrder(quote.id, admin.id, {
        shippingAddress: SAMPLE_ADDRESS,
      })
    ).rejects.toThrow(QuoteNotConvertibleError);
  });

  it("rejects conversion of a guest quote (no associated userId)", async () => {
    const admin = await createAdmin("convert-guest-admin");
    const productId = await createProduct("convert-guest", 10, "20.00");

    const quote = await quoteService.submit(null, {
      name: "Guest Buyer",
      email: uniqueEmail("convert-guest-contact"),
      items: [{ productId, quantity: 1 }],
    });

    const responded = await quoteService.respond(quote.id, admin.id, {
      items: [{ id: quote.items[0].id, quotedUnitPrice: 18 }],
    });
    expect(responded.status).toBe("QUOTED");

    // A guest can't self-accept (no session) — an admin marks it accepted here purely
    // to isolate the "guest can't convert" behavior from the accept step itself.
    await quoteService.adminUpdateStatus(quote.id, admin.id, "ACCEPTED");

    await expect(
      quoteService.convertToOrder(quote.id, admin.id, { shippingAddress: SAMPLE_ADDRESS })
    ).rejects.toThrow(QuoteMissingUserForConversionError);
  });
});
