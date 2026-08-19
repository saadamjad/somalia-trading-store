import { z } from "zod";

/** Mirrors the client-side `CartItem` shape (src/lib/types/product.ts) — no price. */
export const cartItemInputSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().positive({ message: "Quantity must be at least 1." }),
});

/** Body for PUT /api/cart — a batch of items to merge into the caller's server cart. */
export const cartMergeSchema = z.object({
  items: z.array(cartItemInputSchema),
});

/** Body for POST /api/cart/validate when validating an arbitrary (e.g. guest) cart. */
export const cartValidateSchema = z.object({
  items: z.array(cartItemInputSchema).optional(),
});

export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type CartMergeInput = z.infer<typeof cartMergeSchema>;
