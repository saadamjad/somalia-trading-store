import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { GET, PATCH } from "./route";

// See src/app/api/products/route.test.ts for why session resolution is mocked here
// rather than relying on next-auth's headers()-based request scope.
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

const SEEDED_PRODUCT_SLUG = "premium-wooden-interior-door";

describe("GET /api/inventory — permission enforcement", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/inventory — permission enforcement", () => {
  it("rejects an unauthenticated adjustment request with 401 and makes no change", async () => {
    const product = await prisma.product.findUniqueOrThrow({
      where: { slug: SEEDED_PRODUCT_SLUG },
    });
    const before = await prisma.inventory.findUniqueOrThrow({
      where: { productId: product.id },
    });

    const res = await PATCH(
      makeRequest("http://localhost:3000/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          delta: 1000,
          reason: "MANUAL_ADJUSTMENT",
        }),
      })
    );

    expect(res.status).toBe(401);

    const after = await prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } });
    expect(after.quantity).toBe(before.quantity);
  });
});
