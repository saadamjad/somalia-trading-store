import type { Category } from "@/lib/types/product";

export const categories: Category[] = [
  {
    slug: "construction-materials",
    name: "Construction Materials",
    description:
      "Building materials, doors, hardware, and construction supplies for residential, commercial, and infrastructure projects.",
    shortDescription:
      "Building materials, doors, hardware, and supplies for every project scale.",
    image:
      "https://images.unsplash.com/photo-1678555815116-52c1b10517f5?w=900&q=80",
    heroImage:
      "https://images.unsplash.com/photo-1722604676113-36d5e770519a?w=1600&q=80",
    subcategories: ["Doors", "Building Materials", "Hardware", "Accessories"],
    accentColor: "#8B7355",
  },
  {
    slug: "road-interlocks",
    name: "Road Interlocks",
    description:
      "Specialists in paver blocks and road surfacing — zig-zag interlocking pavers, hexagonal and geometric designs, hollow concrete blocks, and installation materials including base, sand, and gravel.",
    shortDescription:
      "Interlocking paver blocks, hollow concrete blocks, geometric designs, and installation materials for roads and pathways.",
    image: "/images/products/road-interlocks/paver-zigzag-interlock.png",
    heroImage: "/images/products/road-interlocks/fgt-paver-catalog.png",
    subcategories: [
      "Interlocking Pavers",
      "Hexagonal Pavers",
      "Geometric Pavers",
      "Hollow Concrete Blocks",
      "Paver Installation Materials",
      "Kerbstones",
    ],
    accentColor: "#6B7280",
  },
  {
    slug: "fishing-products",
    name: "Fishing Products",
    description:
      "Professional fishing equipment including rods, reels, lines, hooks, lures, and marine accessories.",
    shortDescription:
      "Rods, reels, lines, hooks, lures, and essential fishing accessories.",
    image:
      "https://images.unsplash.com/photo-1650081484358-b338642813c0?w=900&q=80",
    heroImage:
      "https://images.unsplash.com/photo-1676396096916-4d1849f66e45?w=1600&q=80",
    subcategories: ["Rods", "Reels", "Lines", "Hooks", "Lures", "Accessories"],
    accentColor: "#0D9488",
  },
];

export function getCategoryBySlug(slug: string) {
  return categories.find((c) => c.slug === slug);
}
