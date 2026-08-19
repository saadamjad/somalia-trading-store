import { z } from "zod";

const reasonEnum = z.enum([
  "MANUAL_ADJUSTMENT",
  "RESTOCK",
  "CORRECTION",
  "ORDER_PLACED",
  "ORDER_CANCELLED",
]);

/**
 * Stock adjustment input. Deliberately a signed `delta`, never an absolute "new
 * quantity" — the caller states the change they want to make, and the server
 * re-validates it against the current DB row inside a transaction (see
 * inventory-service.ts). This is what protects against lost updates / naive
 * overselling under concurrent requests (spec cross-cutting standard).
 */
export const stockAdjustSchema = z.object({
  productId: z.string().trim().min(1),
  delta: z.number().int().refine((n) => n !== 0, "Adjustment delta must not be zero."),
  reason: reasonEnum,
  note: z.string().trim().min(1).max(500).optional(),
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
