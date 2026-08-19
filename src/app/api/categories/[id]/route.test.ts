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

const SEEDED_CATEGORY_SLUG = "fishing-products";

describe("PATCH/DELETE /api/categories/[id] — permission enforcement", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated PATCH with 401 and makes no change", async () => {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: SEEDED_CATEGORY_SLUG },
    });

    const res = await PATCH(
      makeRequest(`http://localhost:3000/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hijacked Name" }),
      }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(res.status).toBe(401);

    const unchanged = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    expect(unchanged.name).toBe(category.name);
  });

  it("rejects an unauthenticated DELETE with 401 and does not delete the category", async () => {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: SEEDED_CATEGORY_SLUG },
    });

    const res = await DELETE(
      makeRequest(`http://localhost:3000/api/categories/${category.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: category.id }) }
    );

    expect(res.status).toBe(401);

    const stillExists = await prisma.category.findUnique({ where: { id: category.id } });
    expect(stillExists).not.toBeNull();
  });
});
