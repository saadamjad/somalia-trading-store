import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { GET, POST } from "./route";

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

function postJson(url: string, body: unknown) {
  return makeRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const productIds: string[] = [];

function uniqueEmail(label: string) {
  const email = `product-reviews-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createCustomer(label: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Product Reviews Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  return { userId: user.id, email: user.email, name: user.name, role: "customer", mustChangePassword: false };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `product-reviews-route-test-${label}-${runId}`,
      name: `Product Reviews Route Test Product (${label})`,
      description: "Test fixture product.",
      shortDescription: "Test fixture.",
      categoryId: category.id,
      price: "15.00",
      images: ["https://example.com/test.jpg"],
    },
  });
  productIds.push(product.id);
  return product.id;
}

describe("/api/products/[id]/reviews", () => {
  afterAll(async () => {
    await prisma.review.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("GET returns an empty approved list with no session required", async () => {
    const productId = await createProduct("get-empty");
    const res = await GET(makeRequest(`http://localhost:3000/api/products/${productId}/reviews`), {
      params: Promise.resolve({ id: productId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("POST rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await POST(
      postJson("http://localhost:3000/api/products/x/reviews", { rating: 5, body: "Great!" }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(401);
  });

  it("POST creates a PENDING review for the authenticated caller, ignoring any client-supplied verifiedPurchase/status", async () => {
    const customer = await createCustomer("create");
    const productId = await createProduct("create");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await POST(
      postJson(`http://localhost:3000/api/products/${productId}/reviews`, {
        rating: 5,
        title: "Love it",
        body: "Exceeded expectations.",
        verifiedPurchase: true, // must be ignored — never purchased in this test
        status: "APPROVED", // must be ignored — always starts PENDING
      }),
      { params: Promise.resolve({ id: productId }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.verifiedPurchase).toBe(false);

    // A PENDING review must not appear in the public approved-only listing yet.
    const listRes = await GET(
      makeRequest(`http://localhost:3000/api/products/${productId}/reviews`),
      { params: Promise.resolve({ id: productId }) }
    );
    const listBody = await listRes.json();
    expect(listBody.items).toEqual([]);
  });

  it("POST rejects an out-of-range rating with 400", async () => {
    const customer = await createCustomer("bad-rating");
    const productId = await createProduct("bad-rating");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await POST(
      postJson(`http://localhost:3000/api/products/${productId}/reviews`, {
        rating: 6,
        body: "Too high a rating.",
      }),
      { params: Promise.resolve({ id: productId }) }
    );
    expect(res.status).toBe(400);
  });

  it("POST rejects a second review from the same user for the same product with 409", async () => {
    const customer = await createCustomer("dup");
    const productId = await createProduct("dup");
    vi.mocked(requireSession).mockResolvedValue(customer);

    await POST(
      postJson(`http://localhost:3000/api/products/${productId}/reviews`, {
        rating: 4,
        body: "First review.",
      }),
      { params: Promise.resolve({ id: productId }) }
    );
    const res = await POST(
      postJson(`http://localhost:3000/api/products/${productId}/reviews`, {
        rating: 2,
        body: "Second attempt.",
      }),
      { params: Promise.resolve({ id: productId }) }
    );
    expect(res.status).toBe(409);
  });
});
