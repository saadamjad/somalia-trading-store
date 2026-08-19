import { z } from "zod";
import { RefundReasonCategory, RefundRequestStatus } from "@/generated/prisma/client";

/**
 * Body for POST /api/refund-requests. `orderId` is ownership-checked server-side
 * (refund-service.ts `createForOwner`) — never trusted as-is. No amount/refund-value
 * field exists anywhere in this schema: this is a request-to-review workflow, not a
 * financial transaction (docs/DECISIONS.md D-007).
 */
export const refundRequestCreateSchema = z.object({
  orderId: z.string().trim().min(1, { message: "orderId is required." }),
  reasonCategory: z.nativeEnum(RefundReasonCategory),
  reasonDetail: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type RefundRequestCreateInput = z.infer<typeof refundRequestCreateSchema>;

/**
 * Body for PATCH /api/admin/refund-requests/[id]. `status` must be APPROVED or
 * REJECTED or UNDER_REVIEW — never back to REQUESTED (no "un-review" action in this
 * phase). `adminNote` is optional and, when supplied, is customer-visible (see the
 * schema comment on RefundRequest.adminNote) — write a note meant for the customer to
 * read, not an internal-only aside.
 */
export const refundRequestAdminUpdateSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED"]),
  adminNote: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type RefundRequestAdminUpdateInput = z.infer<typeof refundRequestAdminUpdateSchema>;

/** Query params for GET /api/admin/refund-requests — filter by status only. */
export const refundRequestAdminQuerySchema = z.object({
  status: z.nativeEnum(RefundRequestStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type RefundRequestAdminQueryInput = z.infer<typeof refundRequestAdminQuerySchema>;
