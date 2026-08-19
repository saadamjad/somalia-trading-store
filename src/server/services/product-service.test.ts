import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { productService } from "@/server/services/product-service";

// Regression coverage (Phase 4 acceptance criteria): the 3 seeded demo
// products/categories must still render correctly through the DB-backed service, the
// same way they did through the old in-memory service.
describe("productService (DB-backed)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("lists the seeded categories with derived subcategories", async () => {
    const categories = await productService.getCategories();
    expect(categories.length).toBeGreaterThanOrEqual(3);

    const construction = categories.find((c) => c.slug === "construction-materials");
    expect(construction).toBeDefined();
    expect(construction?.subcategories).toContain("Doors");
  });

  it("gets a single category by slug", async () => {
    const category = await productService.getCategory("road-interlocks");
    expect(category?.name).toBe("Road Interlocks");
  });

  it("returns undefined for an unknown category slug", async () => {
    const category = await productService.getCategory("not-a-real-category");
    expect(category).toBeUndefined();
  });

  it("lists all seeded products, mapped to the domain Product shape", async () => {
    const products = await productService.getAll();
    expect(products.length).toBeGreaterThanOrEqual(3);

    const door = products.find((p) => p.slug === "premium-wooden-interior-door");
    expect(door).toBeDefined();
    expect(door?.category).toBe("construction-materials");
    expect(door?.subcategory).toBe("Doors");
    expect(door?.purchasingMode).toBe("buy_online");
    expect(door?.availability).toBe("in_stock");
    expect(typeof door?.price).toBe("number");
  });

  it("gets a product by category + slug", async () => {
    const product = await productService.getBySlug(
      "road-interlocks",
      "interlocking-paver-block"
    );
    expect(product?.name).toBe("Interlocking Paver Block");
    expect(product?.price).toBe(9);
  });

  it("returns undefined when the category doesn't match the product's real category", async () => {
    const product = await productService.getBySlug(
      "fishing-products",
      "interlocking-paver-block"
    );
    expect(product).toBeUndefined();
  });

  it("filters products by category", async () => {
    const products = await productService.getByCategory("fishing-products");
    expect(products.every((p) => p.category === "fishing-products")).toBe(true);
    expect(products.some((p) => p.slug === "professional-fishing-rod")).toBe(true);
  });

  it("queryCategory paginates, filters, and sorts within a category", async () => {
    const result = await productService.queryCategory("construction-materials", {
      page: 1,
      pageSize: 1,
    });
    expect(result.items.length).toBeLessThanOrEqual(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
    expect(result.priceRange[0]).toBeLessThanOrEqual(result.priceRange[1]);
  });

  it("search finds a seeded product by name", async () => {
    const results = await productService.search("fishing rod");
    expect(results.some((p) => p.slug === "professional-fishing-rod")).toBe(true);
  });

  it("createProduct rejects an unknown category slug", async () => {
    await expect(
      productService.createProduct({
        slug: "test-product-unknown-category",
        name: "Test Product",
        description: "desc",
        shortDescription: "short desc",
        categorySlug: "not-a-real-category",
        price: 10,
        images: ["https://example.com/1.jpg"],
        purchasingMode: "buy_online",
        availability: "in_stock",
      })
    ).rejects.toThrow(/Category not found/);
  });

  it("creates, updates, and deletes a product end-to-end", async () => {
    const created = await productService.createProduct({
      slug: "test-product-crud",
      name: "Test Product",
      description: "desc",
      shortDescription: "short desc",
      categorySlug: "construction-materials",
      price: 42,
      images: ["https://example.com/1.jpg"],
      purchasingMode: "buy_online",
      availability: "in_stock",
    });
    expect(created.price).toBe(42);

    const updated = await productService.updateProduct(created.id, { price: 55 });
    expect(updated.price).toBe(55);

    await productService.deleteProduct(created.id);
    const afterDelete = await productService.getById(created.id);
    expect(afterDelete).toBeUndefined();
  });
});
