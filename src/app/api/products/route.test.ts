import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { GET, POST } from "./route";

// Route handlers are invoked directly here (not through Next's real HTTP server), so
// there is no AsyncLocalStorage request scope for next-auth's `headers()` call to read
// from. Mocking session resolution to "no session" lets these tests exercise the real
// route handler -> requirePermission -> 401 path without depending on that server-only
// machinery — the underlying "no session -> throws UnauthenticatedError" behavior is
// covered directly in src/server/auth/permissions.test.ts.
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

describe("GET /api/products", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is public and returns the full catalog with no query params", async () => {
    const res = await GET(makeRequest("http://localhost:3000/api/products"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(3);
  });

  it("queries a category with pagination", async () => {
    const res = await GET(
      makeRequest("http://localhost:3000/api/products?category=road-interlocks&page=1&pageSize=1")
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeLessThanOrEqual(1);
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  it("resolves a batch of ids", async () => {
    const listRes = await GET(makeRequest("http://localhost:3000/api/products"));
    const { items } = await listRes.json();
    const ids = items.slice(0, 2).map((p: { id: string }) => p.id);

    const res = await GET(makeRequest(`http://localhost:3000/api/products?ids=${ids.join(",")}`));
    const data = await res.json();
    expect(data.items.map((p: { id: string }) => p.id).sort()).toEqual([...ids].sort());
  });

  it("rejects malformed `filters` JSON with a 400, not a 500", async () => {
    const res = await GET(
      makeRequest("http://localhost:3000/api/products?category=road-interlocks&filters=not-json")
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/products", () => {
  it("rejects an unauthenticated request server-side (401), never reaching product creation", async () => {
    const res = await POST(
      makeRequest("http://localhost:3000/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "should-not-be-created",
          name: "Should Not Be Created",
          description: "desc",
          shortDescription: "short",
          categorySlug: "construction-materials",
          price: 1,
          images: ["https://example.com/1.jpg"],
          purchasingMode: "buy_online",
          availability: "in_stock",
        }),
      })
    );

    expect(res.status).toBe(401);

    const created = await prisma.product.findUnique({
      where: { slug: "should-not-be-created" },
    });
    expect(created).toBeNull();
  });
});
