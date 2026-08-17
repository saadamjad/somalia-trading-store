import type { ActiveFilters } from "@/lib/types/filter";
import type { Product, SortOption } from "@/lib/types/product";

export function applyFilters(
  products: Product[],
  filters: ActiveFilters,
  searchQuery?: string
): Product[] {
  let result = [...products];

  if (searchQuery?.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.toLowerCase().includes(q))
    );
  }

  for (const [key, value] of Object.entries(filters)) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;

    if (key === "price" && Array.isArray(value) && value.length === 2) {
      const [min, max] = value as [number, number];
      result = result.filter((p) => p.price >= min && p.price <= max);
      continue;
    }

    if (key === "subcategory" && Array.isArray(value)) {
      const values = value as string[];
      result = result.filter((p) => values.includes(p.subcategory));
      continue;
    }

    if (key === "availability" && Array.isArray(value)) {
      const values = value as string[];
      result = result.filter((p) => values.includes(p.availability));
      continue;
    }

    if (Array.isArray(value)) {
      const values = value as string[];
      result = result.filter((p) => {
        const specValue =
          p.specifications[
            key.charAt(0).toUpperCase() + key.slice(1)
          ] ?? p.specifications[key];
        if (!specValue) return false;
        return values.some((v) =>
          String(specValue).toLowerCase().includes(v.toLowerCase())
        );
      });
    }
  }

  return result;
}

export function sortProducts(
  products: Product[],
  sort: SortOption
): Product[] {
  const sorted = [...products];

  switch (sort) {
    case "featured":
      return sorted.sort(
        (a, b) => Number(b.featured) - Number(a.featured)
      );
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    default:
      return sorted;
  }
}

export function getPriceRange(products: Product[]): [number, number] {
  if (products.length === 0) return [0, 1000];
  const prices = products.map((p) => p.price);
  return [Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices))];
}
