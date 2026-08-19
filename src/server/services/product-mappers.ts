import type {
  Availability as PrismaAvailability,
  Category as PrismaCategory,
  Prisma,
  Product as PrismaProduct,
  PurchasingMode as PrismaPurchasingMode,
} from "@/generated/prisma/client";
import type {
  Availability,
  Category,
  Product,
  PurchasingMode,
} from "@/lib/types/product";

type PrismaProductWithCategory = PrismaProduct & { category: PrismaCategory };

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

/**
 * Maps a Prisma Product (+ its Category relation) onto the pre-existing `Product`
 * shape from src/lib/types/product.ts, so callers of the old in-memory service barely
 * notice the swap. `category` on the domain type is the category's slug (a string),
 * matching how the demo data always modeled it.
 */
export function toDomainProduct(row: PrismaProductWithCategory): Product {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku ?? undefined,
    name: row.name,
    category: row.category.slug,
    subcategory: row.subcategory ?? "",
    description: row.description,
    shortDescription: row.shortDescription,
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

/**
 * Maps a Prisma Category row onto the domain `Category` shape. `subcategories` is
 * derived data (distinct product.subcategory values for this category), passed in
 * separately since it requires its own query — see category-repository.findSubcategories.
 */
export function toDomainCategory(row: PrismaCategory, subcategories: string[]): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    shortDescription: row.shortDescription,
    image: row.image,
    heroImage: row.heroImage,
    subcategories,
    accentColor: row.accentColor,
    parentId: row.parentId,
  };
}

export type { Prisma };
