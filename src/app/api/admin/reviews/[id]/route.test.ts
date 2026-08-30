import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import { reviewService } from "@/server/services/review-service";
import { PATCH } from "./route";

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
  const email = `admin-reviews-route-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

async function createSessionForRole(label: string, roleName: string) {
  const email = uniqueEmail(label);
  const user = await authService.register({
    name: `Admin Reviews Route Test ${label}`,
    email,
    password: "PlainTextPass1",
  });
  if (roleName !== "customer") {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
  }
  return { userId: user.id, email: user.email, name: user.name, role: roleName, mustChangePassword: false };
}

async function createProduct(label: string) {
  const category = await prisma.category.findFirstOrThrow();
  const product = await prisma.product.create({
    data: {
      slug: `admin-reviews-route-test-${label}-${runId}`,
      name: `Admin Reviews Route Test Product (${label})`,
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

describe("/api/admin/reviews/[id]", () => {
  afterAll(async () => {
    await prisma.review.deleteMany({ where: { user: { email: { in: testEmails } } } });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  async function makePendingReview(labelPrefix: string) {
    const customer = await createSessionForRole(`${labelPrefix}-customer`, "customer");
    const productId = await createProduct(labelPrefix);
    const review = await reviewService.create({
      productId,
      userId: customer.userId,
      rating: 4,
      body: "Solid product.",
    });
    return { customer, productId, review };
  }

  it("PATCH rejects an unauthenticated request with 401", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    const res = await PATCH(patchJson("http://localhost:3000/api/admin/reviews/x", { status: "APPROVED" }), {
      params: Promise.resolve({ id: "x" }),
    });
    expect(res.status).toBe(401);
  });

  it("PATCH rejects a plain customer (no reviews.manage) with 403", async () => {
    const { customer, review } = await makePendingReview("no-perm");
    vi.mocked(requireSession).mockResolvedValue(customer);

    const res = await PATCH(
      patchJson(`http://localhost:3000/api/admin/reviews/${review.id}`, { status: "APPROVED" }),
      { params: Promise.resolve({ id: review.id }) }
    );
    expect(res.status).toBe(403);
  });

  it("PATCH approves a review for an admin with reviews.manage", async () => {
    const { review } = await makePendingReview("approve");
    const admin = await createSessionForRole("approve-admin", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await PATCH(
      patchJson(`http://localhost:3000/api/admin/reviews/${review.id}`, { status: "APPROVED" }),
      { params: Promise.resolve({ id: review.id }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.status).toBe("APPROVED");
  });

  it("PATCH rejects an invalid status value with 400", async () => {
    const { review } = await makePendingReview("bad-status");
    const admin = await createSessionForRole("bad-status-admin", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await PATCH(
      patchJson(`http://localhost:3000/api/admin/reviews/${review.id}`, { status: "PENDING" }),
      { params: Promise.resolve({ id: review.id }) }
    );
    expect(res.status).toBe(400);
  });

  it("PATCH returns 404 for a non-existent review", async () => {
    const admin = await createSessionForRole("missing-admin", "super_admin");
    vi.mocked(requireSession).mockResolvedValue(admin);

    const res = await PATCH(
      patchJson("http://localhost:3000/api/admin/reviews/does-not-exist", { status: "APPROVED" }),
      { params: Promise.resolve({ id: "does-not-exist" }) }
    );
    expect(res.status).toBe(404);
  });
});
