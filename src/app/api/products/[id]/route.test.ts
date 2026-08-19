import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { PATCH, DELETE } from "./route";

// See src/app/api/products/route.test.ts for why session resolution is mocked here
// rather than relying on next-auth's headers()-based request scope, which isn't
// available when a route handler is invoked directly outside Next's HTTP server.
vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return {
    ...actual,
    requireSession: vi.fn().mockRejectedValue(new actual.UnauthenticatedError()),
    getCurrentSession: vi.fn().mockResolvedValue(null),
  };
});

function makeRequest(
  url: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

// Uses the real seeded product rather than an arbitrary id — these requests must be
// rejected before the service layer even looks the product up.
const SEEDED_PRODUCT_SLUG = "premium-wooden-interior-door";

describe("PATCH/DELETE /api/products/[id] — permission enforcement", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated PATCH with 401 and makes no change", async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: SEEDED_PRODUCT_SLUG },
    });

    const res = await PATCH(
      makeRequest(`http://localhost:3000/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hijacked Name" }),
      }),
      { params: Promise.resolve({ id: product.id }) }
    );

    expect(res.status).toBe(401);

    const unchanged = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(unchanged.name).toBe(product.name);
  });

  it("rejects an unauthenticated DELETE with 401 and does not delete the product", async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: SEEDED_PRODUCT_SLUG },
    });

    const res = await DELETE(
      makeRequest(`http://localhost:3000/api/products/${product.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: product.id }) }
    );

    expect(res.status).toBe(401);

    const stillExists = await prisma.product.findUnique({ where: { id: product.id } });
    expect(stillExists).not.toBeNull();
  });
});
