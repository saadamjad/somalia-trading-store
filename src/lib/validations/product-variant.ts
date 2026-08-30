import { z } from "zod";

const attributesSchema = z.record(z.string(), z.string().trim().min(1)).refine(
  (attrs) => Object.keys(attrs).length > 0,
  { message: "At least one attribute (e.g. size, color) is required." }
);

/** Body for POST /api/products/[id]/variants — admin only. */
export const variantCreateSchema = z.object({
  sku: z.string().trim().min(1, { message: "SKU is required." }).max(100),
  attributes: attributesSchema,
  price: z.coerce.number().min(0).nullable().optional(),
  image: z.string().trim().url().nullable().optional().or(z.literal("")),
  initialStock: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});

export type VariantCreateInput = z.infer<typeof variantCreateSchema>;

/** Body for PATCH /api/products/[id]/variants/[variantId] — admin only. */
export const variantUpdateSchema = z.object({
  sku: z.string().trim().min(1).max(100).optional(),
  attributes: attributesSchema.optional(),
  price: z.coerce.number().min(0).nullable().optional(),
  image: z.string().trim().url().nullable().optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>;

const reasonEnum = z.enum(["MANUAL_ADJUSTMENT", "RESTOCK", "CORRECTION"]);

/** Body for POST /api/products/[id]/variants/[variantId]/stock — admin only. Same
 * signed-delta, never-absolute-quantity contract as stockAdjustSchema. */
export const variantStockAdjustSchema = z.object({
  delta: z.number().int().refine((n) => n !== 0, "Adjustment delta must not be zero."),
  reason: reasonEnum,
  note: z.string().trim().min(1).max(500).optional(),
});

export type VariantStockAdjustInput = z.infer<typeof variantStockAdjustSchema>;
