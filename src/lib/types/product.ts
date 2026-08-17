export type CategorySlug =
  | "construction-materials"
  | "road-interlocks"
  | "fishing-products";

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
  currency: "USD";
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
  slug: CategorySlug;
  name: string;
  description: string;
  shortDescription: string;
  image: string;
  heroImage: string;
  subcategories: string[];
  accentColor: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
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
