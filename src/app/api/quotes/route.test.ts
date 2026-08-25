import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { __resetRateLimitStateForTests } from "@/server/lib/rate-limit";
import { GET, POST } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
    requireSession: vi.fn(),
  };
});

import { getCurrentSession, requireSession, UnauthenticatedError } from "@/server/auth/session";

function makeRequest(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function postJson(body: unknown) {
  return makeRequest("http://localhost:3000/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `phase11-quote-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Quote Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  return { userId: user.id, email: user.email, name: `Quote Route Test ${label}`, role: "customer", mustChangePassword: false };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `quote-route-test-${label}-${runId}`,
      name: `Quote Route Test Product (${label})`,
      description: "Test fixture product for quote route tests.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "12.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  await prisma.inventory.create({ data: { productId: product.id, quantity: 25 } });
  return product.id;
}

describe("GET/POST /api/quotes", () => {
  afterAll(async () => {
    await prisma.quoteStatusHistory.deleteMany({ where: { quote: { contactEmail: { in: testEmails } } } });
    await prisma.quoteItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.quote.deleteMany({ where: { contactEmail: { in: testEmails } } });
    await prisma.inventory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("lets a GUEST (no session) submit a quote request, creating a Quote + QuoteItems with status NEW", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const productId = await createProduct("guest-post");
    const guestEmail = uniqueEmail("guest-post-contact");

    const res = await POST(
      postJson({
        name: "Guest Buyer",
        email: guestEmail,
        items: [{ productId, quantity: 3 }],
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.status).toBe("NEW");
    expect(body.item.user).toBeNull();

    const stored = await prisma.quote.findUniqueOrThrow({ where: { id: body.item.id } });
    expect(stored.userId).toBeNull();
    expect(stored.status).toBe("NEW");

    const items = await prisma.quoteItem.findMany({ where: { quoteId: stored.id } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it("attaches the session userId when a logged-in customer submits a quote", async () => {
    const customer = await createCustomer("logged-in-post");
    vi.mocked(getCurrentSession).mockResolvedValue(customer);
    const productId = await createProduct("logged-in-post");

    const res = await POST(
      postJson({
        name: customer.name,
        email: customer.email,
        items: [{ productId, quantity: 1 }],
      })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.user.id).toBe(customer.userId);
  });

  it("rejects a submission with no items", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await POST(postJson({ name: "No Items", email: uniqueEmail("no-items"), items: [] }));
    expect(res.status).toBe(400);
  });

  it("rejects unauthenticated GET with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET scopes to the caller's own quotes only (IDOR)", async () => {
    const customerA = await createCustomer("get-owner");
    const customerB = await createCustomer("get-other");
    vi.mocked(getCurrentSession).mockResolvedValue(customerA);
    const productId = await createProduct("get-owner");

    const postRes = await POST(
      postJson({ name: customerA.name, email: customerA.email, items: [{ productId, quantity: 1 }] })
    );
    const created = await postRes.json();

    vi.mocked(requireSession).mockResolvedValue(customerA);
    const ownRes = await GET();
    const ownList = await ownRes.json();
    expect(ownList.items.some((q: { id: string }) => q.id === created.item.id)).toBe(true);

    vi.mocked(requireSession).mockResolvedValue(customerB);
    const otherRes = await GET();
    const otherList = await otherRes.json();
    expect(otherList.items.some((q: { id: string }) => q.id === created.item.id)).toBe(false);
  });

  it("rate-limits POST /api/quotes after too many requests from the same IP (429)", async () => {
    __resetRateLimitStateForTests();
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const productId = await createProduct("rate-limit");

    // RATE_LIMITS.quote allows 10 requests/minute per IP — the 11th from the same IP
    // must be rejected with 429, independent of whether the payload itself is valid.
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await POST(
        postJson({ name: "Rate Limit Test", email: uniqueEmail(`rate-limit-${i}`), items: [{ productId, quantity: 1 }] })
      );
      lastStatus = res.status;
      if (i < 10) {
        expect(res.status).toBe(201);
      }
    }

    expect(lastStatus).toBe(429);
  });
});
