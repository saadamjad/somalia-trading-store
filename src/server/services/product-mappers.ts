import type {
  Availability as PrismaAvailability,
  Category as PrismaCategory,
  CategoryTranslation as PrismaCategoryTranslation,
  Prisma,
  Product as PrismaProduct,
  ProductTranslation as PrismaProductTranslation,
  PurchasingMode as PrismaPurchasingMode,
} from "@/generated/prisma/client";
import type {
  Availability,
  Category,
  Product,
  PurchasingMode,
} from "@/lib/types/product";
import { defaultLocale, type Locale } from "@/config/i18n";
import { resolveTranslation } from "@/server/services/i18n/resolve-translation";

type PrismaProductWithCategory = PrismaProduct & {
  category: PrismaCategory;
  translations?: PrismaProductTranslation[];
};
type PrismaCategoryWithTranslations = PrismaCategory & {
  translations?: PrismaCategoryTranslation[];
};

const purchasingModeMap: Record<PrismaPurchasingMode, PurchasingMode> = {
  BUY_ONLINE: "buy_online",
  QUOTE_ONLY: "quote_only",
  BOTH: "both",
};

const availabilityMap: Record<PrismaAvailability, Availability> = {
  IN_STOCK: "in_stock",
  LIMITED: "limited",
  OUT_OF_STOCK: "out_of_stock",
  MADE_TO_ORDER: "made_to_order",
};

const purchasingModeReverseMap: Record<PurchasingMode, PrismaPurchasingMode> = {
  buy_online: "BUY_ONLINE",
  quote_only: "QUOTE_ONLY",
  both: "BOTH",
};

const availabilityReverseMap: Record<Availability, PrismaAvailability> = {
  in_stock: "IN_STOCK",
  limited: "LIMITED",
  out_of_stock: "OUT_OF_STOCK",
  made_to_order: "MADE_TO_ORDER",
};

export function toDomainPurchasingMode(value: PrismaPurchasingMode): PurchasingMode {
  return purchasingModeMap[value];
}

export function toDomainAvailability(value: PrismaAvailability): Availability {
  return availabilityMap[value];
}

export function toPrismaPurchasingMode(value: PurchasingMode): PrismaPurchasingMode {
  return purchasingModeReverseMap[value];
}

export function toPrismaAvailability(value: Availability): PrismaAvailability {
  return availabilityReverseMap[value];
}

type LocalizedProductFields = {
  name: string;
  description: string;
  shortDescription: string;
  slug: string | null;
};

/**
 * Maps a Prisma Product (+ its Category relation) onto the pre-existing `Product`
 * shape from src/lib/types/product.ts, so callers of the old in-memory service barely
 * notice the swap. `category` on the domain type is the category's slug (a string),
 * matching how the demo data always modeled it.
 *
 * `locale` (default: defaultLocale/English) resolves ProductTranslation for name/
 * description/shortDescription/slug via resolveTranslation (requirement §24/§27) — the
 * base row's own English fields are always the fallback, so a product missing a
 * translation for the requested locale never renders as blank/undefined. `slug` falls
 * back further, to the base Product.slug, since a ProductTranslation's own slug is
 * optional (schema comment on ProductTranslation.slug).
 *
 * `category` is deliberately always the base (English) Category.slug, never a
 * localized category slug — it's used as a stable identity for cart/wishlist/URL
 * matching (product-service.ts's getBySlug checks `row.category.slug === category`),
 * and localizing it would mean resolving two independent translations just to build
 * one route. Product detail URLs are therefore `/{locale}/shop/{en-category-slug}/
 * {locale-product-slug}` — only the product segment is localized.
 */
export function toDomainProduct(
  row: PrismaProductWithCategory,
  locale: Locale = defaultLocale
): Product {
  const localized = resolveTranslation<
    PrismaProductWithCategory,
    PrismaProductTranslation,
    LocalizedProductFields
  >(row, row.translations ?? [], locale, (source) => ({
    name: source.name,
    description: source.description,
    shortDescription: source.shortDescription,
    slug: "slug" in source ? source.slug : row.slug,
  }));

  return {
    id: row.id,
    slug: localized.slug ?? row.slug,
    sku: row.sku ?? undefined,
    name: localized.name,
    category: row.category.slug,
    subcategory: row.subcategory ?? "",
    description: localized.description,
    shortDescription: localized.shortDescription,
    price: Number(row.price),
    compareAtPrice: row.compareAtPrice ? Number(row.compareAtPrice) : undefined,
    currency: row.currency,
    priceUnit: row.priceUnit ?? undefined,
    images: row.images,
    specifications: (row.specifications as Record<string, string>) ?? {},
    purchasingMode: toDomainPurchasingMode(row.purchasingMode),
    availability: toDomainAvailability(row.availability),
    featured: row.featured,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
  };
}

type LocalizedCategoryFields = {
  name: string;
  description: string;
  shortDescription: string;
  slug: string | null;
};

/**
 * Maps a Prisma Category row onto the domain `Category` shape. `subcategories` is
 * derived data (distinct product.subcategory values for this category), passed in
 * separately since it requires its own query — see category-repository.findSubcategories.
 * `locale` behaves exactly like toDomainProduct's — English base row is the fallback.
 */
export function toDomainCategory(
  row: PrismaCategoryWithTranslations,
  subcategories: string[],
  locale: Locale = defaultLocale
): Category {
  const localized = resolveTranslation<
    PrismaCategoryWithTranslations,
    PrismaCategoryTranslation,
    LocalizedCategoryFields
  >(row, row.translations ?? [], locale, (source) => ({
    name: source.name,
    description: source.description,
    shortDescription: source.shortDescription,
    slug: "slug" in source ? source.slug : row.slug,
  }));

  return {
    id: row.id,
    slug: localized.slug ?? row.slug,
    name: localized.name,
    description: localized.description,
    shortDescription: localized.shortDescription,
    image: row.image,
    heroImage: row.heroImage,
    subcategories,
    accentColor: row.accentColor,
    parentId: row.parentId,
  };
}

export type { Prisma };
