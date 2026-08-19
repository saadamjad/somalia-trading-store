import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { GET, POST } from "./route";

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

describe("GET /api/categories", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is public and lists the seeded categories", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items.length).toBeGreaterThanOrEqual(3);
  });
});

describe("POST /api/categories", () => {
  it("rejects an unauthenticated request server-side (401), never creating the category", async () => {
    const res = await POST(
      makeRequest("http://localhost:3000/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "should-not-be-created",
          name: "Should Not Be Created",
          description: "desc",
          shortDescription: "short",
          image: "https://example.com/1.jpg",
          heroImage: "https://example.com/2.jpg",
          accentColor: "#000000",
        }),
      })
    );

    expect(res.status).toBe(401);

    const created = await prisma.category.findUnique({
      where: { slug: "should-not-be-created" },
    });
    expect(created).toBeNull();
  });
});
