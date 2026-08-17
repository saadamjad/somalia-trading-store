import { products } from "@/lib/data/products";
import { categories, getCategoryBySlug } from "@/lib/data/categories";
import type { CategorySlug, Product, SortOption } from "@/lib/types/product";
import type { ActiveFilters } from "@/lib/types/filter";
import {
  applyFilters,
  sortProducts,
  getPriceRange,
} from "@/lib/filters/apply-filters";
import { searchProducts, getSearchSuggestions } from "@/lib/search/search-products";

export const productService = {
  getAll(): Product[] {
    return products;
  },

  getById(id: string): Product | undefined {
    return products.find((p) => p.id === id);
  },

  getBySlug(category: CategorySlug, slug: string): Product | undefined {
    return products.find((p) => p.category === category && p.slug === slug);
  },

  getByCategory(category: CategorySlug): Product[] {
    return products.filter((p) => p.category === category);
  },

  getFeatured(limit = 8): Product[] {
    return products.filter((p) => p.featured).slice(0, limit);
  },

  getRelated(product: Product, limit = 4): Product[] {
    return products
      .filter(
        (p) => p.category === product.category && p.id !== product.id
      )
      .slice(0, limit);
  },

  getCategories() {
    return categories;
  },

  getCategory(slug: string) {
    return getCategoryBySlug(slug);
  },

  queryCategory(
    category: CategorySlug,
    options: {
      filters?: ActiveFilters;
      sort?: SortOption;
      search?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const {
      filters = {},
      sort = "featured",
      search,
      page = 1,
      pageSize = 12,
    } = options;

    const categoryProducts = this.getByCategory(category);
    const filtered = applyFilters(categoryProducts, filters, search);
    const sorted = sortProducts(filtered, sort);
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);
    const priceRange = getPriceRange(categoryProducts);

    return { items, total, page, pageSize, priceRange, hasMore: start + pageSize < total };
  },

  search(query: string) {
    return searchProducts(products, query);
  },

  getSuggestions(query: string, limit = 6) {
    return getSearchSuggestions(products, query, limit);
  },
};
