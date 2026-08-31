import type { FilterDefinition } from "@/lib/types/filter";
import type { CategorySlug } from "@/lib/types/product";

export const categoryFilters: Record<CategorySlug, FilterDefinition[]> = {
  "construction-materials": [
    {
      key: "subcategory",
      label: "Product Type",
      labelKey: "productType",
      type: "checkbox",
      options: [
        { label: "Doors", value: "Doors" },
        { label: "Building Materials", value: "Building Materials" },
        { label: "Hardware", value: "Hardware" },
        { label: "Accessories", value: "Accessories" },
      ],
    },
    {
      key: "material",
      label: "Material",
      labelKey: "material",
      type: "checkbox",
      specKey: "Material",
      options: [
        { label: "Wood", value: "Wood" },
        { label: "Steel", value: "Steel" },
        { label: "Composite", value: "Composite" },
        { label: "Mixed", value: "Mixed" },
      ],
    },
    {
      key: "availability",
      label: "Availability",
      labelKey: "availability",
      type: "checkbox",
      options: [
        { label: "In Stock", value: "in_stock" },
        { label: "Limited Stock", value: "limited" },
        { label: "Made to Order", value: "made_to_order" },
      ],
    },
    {
      key: "price",
      label: "Price Range",
      labelKey: "priceRange",
      type: "range",
    },
  ],
  "road-interlocks": [
    {
      key: "subcategory",
      label: "Paver Type",
      labelKey: "paverType",
      type: "checkbox",
      options: [
        { label: "Interlocking Pavers", value: "Interlocking Pavers" },
        { label: "Hexagonal Pavers", value: "Hexagonal Pavers" },
        { label: "Geometric Pavers", value: "Geometric Pavers" },
        { label: "Hollow Concrete Blocks", value: "Hollow Concrete Blocks" },
        { label: "Paver Installation Materials", value: "Paver Installation Materials" },
        { label: "Kerbstones", value: "Kerbstones" },
      ],
    },
    {
      key: "material",
      label: "Material",
      labelKey: "material",
      type: "checkbox",
      specKey: "Material",
      options: [
        { label: "Concrete", value: "Concrete" },
        { label: "Reinforced Concrete", value: "Reinforced Concrete" },
      ],
    },
    {
      key: "color",
      label: "Color",
      labelKey: "color",
      type: "checkbox",
      specKey: "Color",
      options: [
        { label: "Grey", value: "Grey" },
        { label: "Charcoal", value: "Charcoal" },
        { label: "Red", value: "Red" },
      ],
    },
    {
      key: "availability",
      label: "Availability",
      labelKey: "availability",
      type: "checkbox",
      options: [
        { label: "In Stock", value: "in_stock" },
        { label: "Limited Stock", value: "limited" },
        { label: "Made to Order", value: "made_to_order" },
      ],
    },
    {
      key: "price",
      label: "Price Range",
      labelKey: "priceRange",
      type: "range",
    },
  ],
  "fishing-products": [
    {
      key: "subcategory",
      label: "Product Type",
      labelKey: "productType",
      type: "checkbox",
      options: [
        { label: "Rods", value: "Rods" },
        { label: "Reels", value: "Reels" },
        { label: "Lines", value: "Lines" },
        { label: "Hooks", value: "Hooks" },
        { label: "Lures", value: "Lures" },
        { label: "Storage", value: "Storage" },
      ],
    },
    {
      key: "brand",
      label: "Brand",
      labelKey: "brand",
      type: "checkbox",
      specKey: "Brand",
      options: [
        { label: "ProMarine", value: "ProMarine" },
        { label: "OceanPro", value: "OceanPro" },
        { label: "CoastalGear", value: "CoastalGear" },
      ],
    },
    {
      key: "material",
      label: "Material",
      labelKey: "material",
      type: "checkbox",
      specKey: "Material",
      options: [
        { label: "Carbon Fiber", value: "Carbon Fiber" },
        { label: "Aluminum", value: "Aluminum" },
        { label: "Stainless Steel", value: "Stainless Steel" },
        { label: "Plastic", value: "Plastic" },
      ],
    },
    {
      key: "availability",
      label: "Availability",
      labelKey: "availability",
      type: "checkbox",
      options: [
        { label: "In Stock", value: "in_stock" },
        { label: "Limited Stock", value: "limited" },
      ],
    },
    {
      key: "price",
      label: "Price Range",
      labelKey: "priceRange",
      type: "range",
    },
  ],
};

export function getFiltersForCategory(category: CategorySlug) {
  return categoryFilters[category] ?? [];
}
