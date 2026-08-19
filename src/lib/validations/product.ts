import { z } from "zod";

const purchasingModeEnum = z.enum(["buy_online", "quote_only", "both"]);
const availabilityEnum = z.enum([
  "in_stock",
  "limited",
  "out_of_stock",
  "made_to_order",
]);

export const productCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, hyphen-separated."),
  sku: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  shortDescription: z.string().trim().min(1),
  categorySlug: z.string().trim().min(1),
  subcategory: z.string().trim().min(1).optional(),
  // Price is admin-supplied input on this write path (the admin is literally setting
  // the price) — never accepted as trusted input on a *read* path like checkout.
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  currency: z.string().trim().length(3).optional(),
  priceUnit: z.string().trim().min(1).optional(),
  images: z.array(z.string().trim().min(1)).min(1),
  specifications: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  purchasingMode: purchasingModeEnum,
  availability: availabilityEnum,
  featured: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
