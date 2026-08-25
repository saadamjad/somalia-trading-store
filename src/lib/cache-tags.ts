/**
 * Cache tag names for Next.js `unstable_cache`/`revalidateTag`. Public pages read
 * through service methods wrapped with these tags; admin mutations call
 * `revalidateTag` after a successful write so the storefront reflects the change on
 * the next request without a redeploy.
 *
 * Collection-level only (not per-entity) — every cached read in this codebase queries
 * a collection (`getAll`, `getBySlug` scanning the products table, etc.), so a single
 * entity's edit needs to invalidate the same cached collection any other entity's edit
 * would. Per-id tags would add write-side complexity with no invalidation-precision
 * benefit at this scale; add them if/when a read path is added that's cached purely
 * per-entity.
 */
export const cacheTags = {
  products: "products",
  categories: "categories",
  banners: "banners",
  cmsPages: "cms-pages",
} as const;
