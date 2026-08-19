import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";

describe("Prisma connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects and round-trips a query against the seeded database", async () => {
    const categories = await prisma.category.findMany({ orderBy: { slug: "asc" } });

    expect(categories.length).toBeGreaterThanOrEqual(3);
    expect(categories.map((c) => c.slug)).toContain("construction-materials");
  });

  it("loads a product with its category relation", async () => {
    const product = await prisma.product.findUnique({
      where: { slug: "interlocking-paver-block" },
      include: { category: true },
    });

    expect(product).not.toBeNull();
    expect(product?.category.slug).toBe("road-interlocks");
    expect(product?.price.toString()).toBe("9");
  });
});
