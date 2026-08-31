import { cachedRead, revalidateTag } from "@/lib/server-cache";
import { categoryRepository } from "@/server/repositories/category-repository";
import { productRepository } from "@/server/repositories/product-repository";
import type {
  ProductCreateInput,
  ProductUpdateInput,
} from "@/server/repositories/product-repository";
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
} from "@/server/repositories/category-repository";
import {
  toDomainCategory,
  toDomainProduct,
  toPrismaAvailability,
  toPrismaPurchasingMode,
} from "@/server/services/product-mappers";
import { applyFilters, getPriceRange, sortProducts } from "@/lib/filters/apply-filters";
import { getSearchSuggestions, searchProducts } from "@/lib/search/search-products";
import { cacheTags } from "@/lib/cache-tags";
import { deleteBlobsBestEffort } from "@/lib/blob";
import type { ActiveFilters } from "@/lib/types/filter";
import type { Category, CategorySlug, Product, SortOption } from "@/lib/types/product";
import { defaultLocale, type Locale } from "@/config/i18n";

export class CategoryNotFoundError extends Error {
  constructor(slugOrId: string) {
    super(`Category not found: ${slugOrId}`);
    this.name = "CategoryNotFoundError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(slugOrId: string) {
    super(`Product not found: ${slugOrId}`);
    this.name = "ProductNotFoundError";
  }
}

export class CategoryCycleError extends Error {
  constructor() {
    super("A category cannot be its own parent or descendant's parent.");
    this.name = "CategoryCycleError";
  }
}

/**
 * Server-side product/category service — Phase 4 replacement for the old in-memory
 * src/lib/services/product-service.ts. Method signatures (getAll, getBySlug,
 * getByCategory, queryCategory, search, ...) are preserved from that contract; every
 * method is now async and reads from Postgres via the repository layer instead of a
 * static array. Callers that used to import the old sync service must become server
 * components/route handlers, or fetch through /api/products for client components
 * (see src/app/api/products/route.ts).
 */
/**
 * Public read methods are wrapped with `unstable_cache` and tagged so that admin
 * mutations (below) can call `revalidateTag` to invalidate exactly the cached data
 * that changed, without a redeploy. Admin-facing reads (getById, admin list pages)
 * intentionally read straight from the repository, uncached, so an admin always sees
 * their own just-made edit immediately.
 */
// locale is an explicit parameter (not read from context) on every cached function
// below so Next's unstable_cache — which keys on keyParts + the actual call
// arguments — never serves an English-cached entry to a Somali request or vice versa
// (requirement §49: "an English cached page must NEVER be served to a Somali URL").
const getAllCached = cachedRead(
  async (locale: Locale) => (await productRepository.findAll()).map((row) => toDomainProduct(row, locale)),
  ["products:getAll"],
  { tags: [cacheTags.products] }
);

const getBySlugCached = cachedRead(
  async (category: CategorySlug, slug: string, locale: Locale) => {
    // Try a locale-specific translated slug first (requirement §22); fall back to the
    // base English slug so a locale-prefixed URL always still resolves the product
    // even when no translated slug has been set for it yet.
    const translatedRow =
      locale === defaultLocale ? null : await productRepository.findByTranslatedSlug(locale, slug);
    const row = translatedRow ?? (await productRepository.findBySlug(slug));
    if (!row || row.category.slug !== category) return undefined;
    return toDomainProduct(row, locale);
  },
  ["products:getBySlug"],
  { tags: [cacheTags.products] }
);

const getByCategoryCached = cachedRead(
  async (category: CategorySlug, locale: Locale) => {
    const categoryRow = await categoryRepository.findBySlug(category);
    if (!categoryRow) return [];
    const rows = await productRepository.findByCategoryId(categoryRow.id);
    return rows.map((row) => toDomainProduct(row, locale));
  },
  ["products:getByCategory"],
  { tags: [cacheTags.products, cacheTags.categories] }
);

const getCategoriesCached = cachedRead(
  async (locale: Locale) => {
    const rows = await categoryRepository.findAll();
    return Promise.all(
      rows.map(async (row) => {
        const subcategories = await categoryRepository.findSubcategories(row.id);
        return toDomainCategory(row, subcategories, locale);
      })
    );
  },
  ["categories:getAll"],
  { tags: [cacheTags.categories] }
);

const getCategoryCached = cachedRead(
  async (slug: string, locale: Locale) => {
    const row = await categoryRepository.findBySlug(slug);
    if (!row) return undefined;
    const subcategories = await categoryRepository.findSubcategories(row.id);
    return toDomainCategory(row, subcategories, locale);
  },
  ["categories:getBySlug"],
  { tags: [cacheTags.categories] }
);

export const productService = {
  async getAll(locale: Locale = defaultLocale): Promise<Product[]> {
    return getAllCached(locale);
  },

  async getById(id: string, locale: Locale = defaultLocale): Promise<Product | undefined> {
    const row = await productRepository.findById(id);
    return row ? toDomainProduct(row, locale) : undefined;
  },

  async getBySlug(
    category: CategorySlug,
    slug: string,
    locale: Locale = defaultLocale
  ): Promise<Product | undefined> {
    return getBySlugCached(category, slug, locale);
  },

  async getByCategory(category: CategorySlug, locale: Locale = defaultLocale): Promise<Product[]> {
    return getByCategoryCached(category, locale);
  },

  async getByIds(ids: string[], locale: Locale = defaultLocale): Promise<Product[]> {
    const rows = await productRepository.findByIds(ids);
    return rows.map((row) => toDomainProduct(row, locale));
  },

  async getRelated(product: Product, limit = 4, locale: Locale = defaultLocale): Promise<Product[]> {
    const categoryProducts = await this.getByCategory(product.category, locale);
    return categoryProducts.filter((p) => p.id !== product.id).slice(0, limit);
  },

  async getFeatured(limit = 8, locale: Locale = defaultLocale): Promise<Product[]> {
    const all = await this.getAll(locale);
    return all.filter((p) => p.featured).slice(0, limit);
  },

  async getCategories(locale: Locale = defaultLocale): Promise<Category[]> {
    return getCategoriesCached(locale);
  },

  async getCategory(slug: string, locale: Locale = defaultLocale): Promise<Category | undefined> {
    return getCategoryCached(slug, locale);
  },

  async getCategoryById(id: string, locale: Locale = defaultLocale): Promise<Category | undefined> {
    const row = await categoryRepository.findById(id);
    if (!row) return undefined;
    const subcategories = await categoryRepository.findSubcategories(row.id);
    return toDomainCategory(row, subcategories, locale);
  },

  /**
   * Filter/sort/paginate products within a category. The catalog is fetched from the
   * DB by category, then filtered/sorted/paginated in-memory using the same pure
   * apply-filters logic the old in-memory service used (src/lib/filters/apply-filters.ts)
   * — this keeps facet filtering (spec-key checkboxes, price range) working exactly as
   * before while the source of truth moves to Postgres. Fine at today's catalog size;
   * if the catalog grows enough to matter, this is the first place to push filtering
   * down into SQL/indexes (see docs/IMPLEMENTATION_PLAN.md cross-cutting standards).
   */
  async queryCategory(
    category: CategorySlug,
    options: {
      filters?: ActiveFilters;
      sort?: SortOption;
      search?: string;
      page?: number;
      pageSize?: number;
      locale?: Locale;
    } = {}
  ) {
    const {
      filters = {},
      sort = "featured",
      search,
      page = 1,
      pageSize = 12,
      locale = defaultLocale,
    } = options;

    const categoryProducts = await this.getByCategory(category, locale);
    const filtered = applyFilters(categoryProducts, filters, search);
    const sorted = sortProducts(filtered, sort);
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);
    const priceRange = getPriceRange(categoryProducts);

    return { items, total, page, pageSize, priceRange, hasMore: start + pageSize < total };
  },

  async search(query: string, locale: Locale = defaultLocale): Promise<Product[]> {
    const all = await this.getAll(locale);
    return searchProducts(all, query);
  },

  async getSuggestions(query: string, limit = 6, locale: Locale = defaultLocale): Promise<Product[]> {
    const all = await this.getAll(locale);
    return getSearchSuggestions(all, query, limit);
  },

  // --- Admin mutations (permission checks happen in the route handler, not here) ---

  async createProduct(input: {
    slug: string;
    sku?: string;
    name: string;
    description: string;
    shortDescription: string;
    categorySlug: string;
    subcategory?: string;
    price: number;
    compareAtPrice?: number;
    currency?: string;
    priceUnit?: string;
    images: string[];
    specifications?: Record<string, string>;
    tags?: string[];
    purchasingMode: Product["purchasingMode"];
    availability: Product["availability"];
    featured?: boolean;
  }): Promise<Product> {
    const category = await categoryRepository.findBySlug(input.categorySlug);
    if (!category) throw new CategoryNotFoundError(input.categorySlug);

    const data: ProductCreateInput = {
      slug: input.slug,
      sku: input.sku ?? null,
      name: input.name,
      description: input.description,
      shortDescription: input.shortDescription,
      categoryId: category.id,
      subcategory: input.subcategory ?? null,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      currency: input.currency ?? "USD",
      priceUnit: input.priceUnit ?? null,
      images: input.images,
      specifications: input.specifications ?? {},
      tags: input.tags ?? [],
      purchasingMode: toPrismaPurchasingMode(input.purchasingMode),
      availability: toPrismaAvailability(input.availability),
      featured: input.featured ?? false,
    };

    const row = await productRepository.create(data);
    revalidateTag(cacheTags.products);
    return toDomainProduct(row);
  },

  async updateProduct(
    id: string,
    input: Partial<{
      slug: string;
      sku: string | null;
      name: string;
      description: string;
      shortDescription: string;
      categorySlug: string;
      subcategory: string | null;
      price: number;
      compareAtPrice: number | null;
      currency: string;
      priceUnit: string | null;
      images: string[];
      specifications: Record<string, string>;
      tags: string[];
      purchasingMode: Product["purchasingMode"];
      availability: Product["availability"];
      featured: boolean;
    }>
  ): Promise<Product> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new ProductNotFoundError(id);

    const { categorySlug, purchasingMode, availability, ...rest } = input;
    const data: ProductUpdateInput = { ...rest };

    if (categorySlug) {
      const category = await categoryRepository.findBySlug(categorySlug);
      if (!category) throw new CategoryNotFoundError(categorySlug);
      data.categoryId = category.id;
    }

    if (purchasingMode) data.purchasingMode = toPrismaPurchasingMode(purchasingMode);
    if (availability) data.availability = toPrismaAvailability(availability);

    const row = await productRepository.update(id, data);
    revalidateTag(cacheTags.products);

    if (input.images) {
      const removedImages = existing.images.filter((url) => !input.images!.includes(url));
      if (removedImages.length > 0) {
        void deleteBlobsBestEffort(removedImages, id);
      }
    }

    return toDomainProduct(row);
  },

  async deleteProduct(id: string): Promise<void> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new ProductNotFoundError(id);
    await productRepository.delete(id);
    revalidateTag(cacheTags.products);
    void deleteBlobsBestEffort(existing.images, id);
  },

  async createCategory(input: CategoryCreateInput): Promise<Category> {
    const row = await categoryRepository.create(input);
    revalidateTag(cacheTags.categories);
    return toDomainCategory(row, []);
  },

  async updateCategory(id: string, input: CategoryUpdateInput): Promise<Category> {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new CategoryNotFoundError(id);

    if (input.parentId) {
      if (input.parentId === id) {
        throw new CategoryCycleError();
      }
      const allCategories = await categoryRepository.findAll();
      const byId = new Map(allCategories.map((c) => [c.id, c]));
      const visited = new Set<string>();
      let cursorId: string | null | undefined = input.parentId;
      while (cursorId) {
        if (cursorId === id) throw new CategoryCycleError();
        if (visited.has(cursorId)) break; // pre-existing cycle unrelated to this update
        visited.add(cursorId);
        cursorId = byId.get(cursorId)?.parentId;
      }
    }

    const row = await categoryRepository.update(id, input);
    const subcategories = await categoryRepository.findSubcategories(row.id);
    revalidateTag(cacheTags.categories);
    revalidateTag(cacheTags.products);

    const removedImages = [existing.image, existing.heroImage].filter(
      (url) => url !== row.image && url !== row.heroImage
    );
    if (removedImages.length > 0) {
      void deleteBlobsBestEffort(removedImages, id);
    }

    return toDomainCategory(row, subcategories);
  },

  async deleteCategory(id: string): Promise<void> {
    const existing = await categoryRepository.findById(id);
    if (!existing) throw new CategoryNotFoundError(id);
    await categoryRepository.delete(id);
    revalidateTag(cacheTags.categories);
    revalidateTag(cacheTags.products);
    void deleteBlobsBestEffort([existing.image, existing.heroImage], id);
  },
};
