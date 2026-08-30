// Phase 4: category slugs are DB-driven (Category.slug), not a closed set known at
// compile time. Was a 3-value union before real categories existed in the DB.
export type CategorySlug = string;

export type PurchasingMode = "buy_online" | "quote_only" | "both";

export type Availability =
  | "in_stock"
  | "limited"
  | "out_of_stock"
  | "made_to_order";

export interface Product {
  id: string;
  slug: string;
  sku?: string;
  name: string;
  category: CategorySlug;
  subcategory: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  // Loosened from the "USD" literal (docs/DECISIONS.md D-006) — the operating currency
  // is an open business decision; USD is only today's default, not a hard assumption.
  currency: string;
  priceUnit?: string;
  images: string[];
  specifications: Record<string, string>;
  purchasingMode: PurchasingMode;
  availability: Availability;
  featured: boolean;
  tags?: string[];
  createdAt: string;
}

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  description: string;
  shortDescription: string;
  image: string;
  heroImage: string;
  // Derived from the distinct `subcategory` values of this category's products (real,
  // data-driven facet list) rather than a hardcoded list — see product-service.ts.
  subcategories: string[];
  accentColor: string;
  parentId?: string | null;
}

export interface CartItem {
  productId: string;
  quantity: number;
  /** Omitted (not null) for a plain, non-variant line — kept optional rather than
   * `| null` so existing persisted localStorage carts (pre-variants) still parse. */
  variantId?: string;
}

export type SortOption =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc";

export const availabilityLabels: Record<Availability, string> = {
  in_stock: "In Stock",
  limited: "Limited Stock",
  out_of_stock: "Out of Stock",
  made_to_order: "Made to Order",
};
