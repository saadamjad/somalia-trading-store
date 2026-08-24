import type { LucideIcon } from "lucide-react";
import { Box, Grid3X3, Layers, DoorOpen, Hammer, Wrench, Fish, Anchor, Waves, Tag } from "lucide-react";
import type { Category, CategorySlug } from "@/lib/types/product";

export interface CategoryBannerImage {
  src: string;
  alt: string;
  featured?: boolean;
  featuredLabel?: string;
  featuredTitle?: string;
}

export interface CategoryBannerConfig {
  eyebrow: string;
  accentWordIndex: number;
  highlights: { icon: LucideIcon; label: string }[];
  images: {
    primary: CategoryBannerImage;
    secondary: CategoryBannerImage;
    tertiary: CategoryBannerImage;
  };
  footerTags?: string[];
  footerColors?: { label: string; color: string }[];
}

export const categoryBannerConfig: Record<CategorySlug, CategoryBannerConfig> = {
  "construction-materials": {
    eyebrow: "Building & Supply",
    accentWordIndex: 1,
    highlights: [
      { icon: DoorOpen, label: "Interior Doors" },
      { icon: Hammer, label: "Building Materials" },
      { icon: Wrench, label: "Hardware" },
    ],
    images: {
      primary: {
        src: "/images/products/construction-material/wooden-doors-trio-display.jpg",
        alt: "Three premium wooden interior doors in grey, walnut, and oak finishes",
        featured: true,
        featuredLabel: "Featured",
        featuredTitle: "Premium Wooden Doors",
      },
      secondary: {
        src: "/images/products/construction-material/wooden-door-living-room.jpg",
        alt: "Walnut interior door installed in a modern living room",
      },
      tertiary: {
        src: "/images/products/construction-material/wooden-door-dining-room.jpg",
        alt: "Wooden interior door installed in a dining room setting",
      },
    },
    footerTags: ["Wood Finish", "Commercial", "Residential"],
  },
  "road-interlocks": {
    eyebrow: "Paver Blocks & Surfacing",
    accentWordIndex: 1,
    highlights: [
      { icon: Grid3X3, label: "Zig-Zag Interlock" },
      { icon: Layers, label: "Hex & Geometric" },
      { icon: Box, label: "Hollow Blocks" },
    ],
    images: {
      primary: {
        src: "/images/products/road-interlocks/paver-zigzag-interlock.png",
        alt: "Zig-zag interlocking paver blocks",
        featured: true,
        featuredLabel: "Featured",
        featuredTitle: "Zig-Zag Interlocking Pavers",
      },
      secondary: {
        src: "/images/products/road-interlocks/hollow-blocks-stacked.png",
        alt: "Hollow concrete blocks stacked",
      },
      tertiary: {
        src: "/images/products/road-interlocks/hollow-concrete-blocks.png",
        alt: "Hollow blocks at construction site",
      },
    },
    footerColors: [
      { label: "Grey", color: "#9ca3af" },
      { label: "Red", color: "#c0392b" },
      { label: "Yellow", color: "#d4a017" },
      { label: "Charcoal", color: "#374151" },
    ],
  },
  "fishing-products": {
    eyebrow: "Marine & Angling",
    accentWordIndex: 0,
    highlights: [
      { icon: Fish, label: "Rods & Reels" },
      { icon: Anchor, label: "Coastal Gear" },
      { icon: Waves, label: "Offshore Ready" },
    ],
    images: {
      primary: {
        src: "https://images.unsplash.com/photo-1650081484358-b338642813c0?w=1200&q=80",
        alt: "Professional fishing rod and reel",
        featured: true,
        featuredLabel: "Featured",
        featuredTitle: "Professional Fishing Rods",
      },
      secondary: {
        src: "https://images.unsplash.com/photo-1676396096916-4d1849f66e45?w=1200&q=80",
        alt: "Fishing rods by the water",
      },
      tertiary: {
        src: "https://images.unsplash.com/photo-1537872384762-e785271d14f8?w=1200&q=80",
        alt: "Fishing reel at the shoreline",
      },
    },
    footerTags: ["Carbon Fiber", "Coastal", "Offshore"],
  },
};

/**
 * Falls back to a generic banner built from the category's own data (image/heroImage/
 * subcategories) for any category that doesn't have hand-authored banner copy above —
 * e.g. a category an admin creates through /admin/categories (Phase 4). Without this,
 * CategoryBanner would crash on `categoryBannerConfig[slug]` being undefined for any
 * category beyond the original 3 demo ones.
 */
function buildDefaultBannerConfig(category: Category): CategoryBannerConfig {
  const image = { src: category.image || category.heroImage, alt: category.name };
  const heroImage = { src: category.heroImage || category.image, alt: category.name };
  return {
    eyebrow: "Catalogue",
    accentWordIndex: 0,
    highlights: category.subcategories.slice(0, 3).map((label) => ({ icon: Tag, label })),
    images: {
      primary: { ...heroImage, featured: true, featuredLabel: "Featured", featuredTitle: category.name },
      secondary: image,
      tertiary: image,
    },
  };
}

export function getCategoryBannerConfig(category: Category): CategoryBannerConfig {
  return categoryBannerConfig[category.slug] ?? buildDefaultBannerConfig(category);
}
