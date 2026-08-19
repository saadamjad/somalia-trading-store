import { z } from "zod";

export const wishlistItemInputSchema = z.object({
  productId: z.string().trim().min(1),
});

export type WishlistItemInput = z.infer<typeof wishlistItemInputSchema>;
