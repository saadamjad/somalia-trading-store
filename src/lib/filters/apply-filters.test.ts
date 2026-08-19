import { describe, expect, it } from "vitest";
import { applyFilters, getPriceRange, sortProducts } from "./apply-filters";
import type { Product } from "@/lib/types/product";

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    slug: "product-1",
    name: "Product 1",
    category: "construction-materials",
    subcategory: "Doors",
    description: "A product",
    shortDescription: "A short description",
    price: 100,
    currency: "USD",
    images: ["https://example.com/1.jpg"],
    specifications: { Material: "Wood" },
    purchasingMode: "buy_online",
    availability: "in_stock",
    featured: false,
    tags: [],
    createdAt: "2025-01-01",
    ...overrides,
  };
}

describe("applyFilters", () => {
  const products: Product[] = [
    makeProduct({ id: "a", name: "Wooden Door", price: 100, subcategory: "Doors", featured: true, specifications: { Material: "Wood" } }),
    makeProduct({ id: "b", name: "Steel Hinge", price: 20, subcategory: "Hardware", availability: "limited", specifications: { Material: "Steel" } }),
    makeProduct({ id: "c", name: "Concrete Block", price: 9, subcategory: "Building Materials", availability: "out_of_stock", specifications: { Material: "Concrete" } }),
  ];

  it("returns all products when no filters or search are given", () => {
    expect(applyFilters(products, {})).toHaveLength(3);
  });

  it("filters by free-text search across name/description/subcategory/sku/tags", () => {
    const result = applyFilters(products, {}, "wooden");
    expect(result.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by price range", () => {
    const result = applyFilters(products, { price: [0, 50] });
    expect(result.map((p) => p.id).sort()).toEqual(["b", "c"]);
  });

  it("filters by subcategory (multiselect)", () => {
    const result = applyFilters(products, { subcategory: ["Doors", "Hardware"] });
    expect(result.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by availability", () => {
    const result = applyFilters(products, { availability: ["limited"] });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  it("filters by an arbitrary spec-key facet (e.g. material)", () => {
    const result = applyFilters(products, { material: ["Steel"] });
    expect(result.map((p) => p.id)).toEqual(["b"]);
  });

  it("ignores empty-array filter values", () => {
    const result = applyFilters(products, { subcategory: [] });
    expect(result).toHaveLength(3);
  });
});

describe("sortProducts", () => {
  const products: Product[] = [
    makeProduct({ id: "a", price: 30, featured: false, createdAt: "2025-01-01" }),
    makeProduct({ id: "b", price: 10, featured: true, createdAt: "2025-03-01" }),
    makeProduct({ id: "c", price: 20, featured: false, createdAt: "2025-02-01" }),
  ];

  it("sorts featured products first", () => {
    const result = sortProducts(products, "featured");
    expect(result[0].id).toBe("b");
  });

  it("sorts by newest first", () => {
    const result = sortProducts(products, "newest");
    expect(result.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by price ascending", () => {
    const result = sortProducts(products, "price-asc");
    expect(result.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by price descending", () => {
    const result = sortProducts(products, "price-desc");
    expect(result.map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...products];
    sortProducts(products, "price-asc");
    expect(products).toEqual(copy);
  });
});

describe("getPriceRange", () => {
  it("returns [min, max] rounded outward across the given products", () => {
    const products = [makeProduct({ price: 9.4 }), makeProduct({ price: 100.2 })];
    expect(getPriceRange(products)).toEqual([9, 101]);
  });

  it("returns a default range for an empty list", () => {
    expect(getPriceRange([])).toEqual([0, 1000]);
  });
});
