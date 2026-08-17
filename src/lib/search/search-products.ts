import type { Product } from "@/lib/types/product";

export function searchProducts(products: Product[], query: string): Product[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase().trim();

  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.shortDescription.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.subcategory.toLowerCase().includes(q) ||
      p.category.replace(/-/g, " ").includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.tags?.some((t) => t.toLowerCase().includes(q))
  );
}

export function getSearchSuggestions(
  products: Product[],
  query: string,
  limit = 6
): Product[] {
  return searchProducts(products, query).slice(0, limit);
}
