import { z } from "zod";
import { ReviewStatus } from "@/generated/prisma/client";

/**
 * Body for POST /api/products/[id]/reviews. Deliberately contains no
 * `verifiedPurchase`/`status`/`userId` field — those are always server-computed
 * (review-service.ts `create`), never accepted from the client, same principle as
 * orderCreateSchema never accepting price/quantity.
 */
export const reviewCreateSchema = z.object({
  rating: z.coerce.number().int().min(1, { message: "Rating must be 1-5." }).max(5, {
    message: "Rating must be 1-5.",
  }),
  title: z.string().trim().max(150).optional().or(z.literal("")),
  body: z.string().trim().min(1, { message: "Review text is required." }).max(5000),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

/** Body for PATCH /api/admin/reviews/[id] — approve or reject only; PENDING is never
 * a valid target (a review starts there, it's never moderated back to it). */
export const reviewAdminUpdateSchema = z.object({
  status: z.enum([ReviewStatus.APPROVED, ReviewStatus.REJECTED]),
});

export type ReviewAdminUpdateInput = z.infer<typeof reviewAdminUpdateSchema>;

/** Query params for GET /api/admin/reviews. */
export const reviewAdminQuerySchema = z.object({
  status: z.nativeEnum(ReviewStatus).optional(),
  productId: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReviewAdminQueryInput = z.infer<typeof reviewAdminQuerySchema>;
