import { z } from "zod";
import { QuoteStatus } from "@/generated/prisma/client";

/**
 * One requested line within a quote submission. `requestedPrice` is purely
 * informational — the customer's hoped-for price — and is NEVER trusted as an
 * authoritative price anywhere downstream (cross-cutting standard); only an admin's
 * `quotedUnitPrice`, set later via `quoteAdminRespondSchema`, can ever become an
 * OrderItem.unitPrice on conversion.
 */
const quoteItemInputSchema = z.object({
  productId: z.string().trim().min(1, { message: "Select a product." }),
  quantity: z.coerce
    .number()
    .int()
    .min(1, { message: "Quantity must be at least 1." })
    .max(1_000_000),
  requestedPrice: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

/**
 * Body for POST /api/quotes. Deliberately GUEST-submittable (no session required) —
 * see docs/IMPLEMENTATION_PLAN.md Phase 11: a quote is a business inquiry, not a
 * purchase, and doesn't need an account. Contact fields are always taken from the
 * request body (even for a logged-in submitter, mirroring Order's shipping-address
 * snapshot pattern — see Quote's schema comment) rather than silently read off the
 * session/profile.
 */
export const quoteCreateSchema = z.object({
  name: z.string().trim().min(1, { message: "Full name is required." }).max(200),
  email: z.string().trim().email({ message: "A valid email is required." }).max(320),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z
    .array(quoteItemInputSchema)
    .min(1, { message: "Add at least one product to your quote request." })
    .max(50),
});

export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>;

/**
 * Body for PATCH /api/admin/quotes/[id] when responding with pricing (moves the quote
 * to QUOTED). Every item on the quote must receive a `quotedUnitPrice` — a partially
 * priced quote isn't a valid response (quote-service.ts `respond` re-validates this
 * against the quote's actual item ids, not just this shape).
 */
export const quoteAdminRespondSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        quotedUnitPrice: z.coerce.number().min(0, { message: "Price cannot be negative." }),
      })
    )
    .min(1),
  adminNote: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type QuoteAdminRespondInput = z.infer<typeof quoteAdminRespondSchema>;

/**
 * Body for PATCH /api/admin/quotes/[id] when moving to a plain status (REVIEWING /
 * ACCEPTED / DECLINED — never QUOTED or CONVERTED, which have their own dedicated
 * actions/schemas). Validated again against the allowed-transitions map in
 * quote-service.ts; this schema only bounds the shape.
 */
export const quoteAdminStatusUpdateSchema = z.object({
  status: z.enum(["REVIEWING", "ACCEPTED", "DECLINED"]),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type QuoteAdminStatusUpdateInput = z.infer<typeof quoteAdminStatusUpdateSchema>;

/** Body for PATCH /api/quotes/[id] — the customer's own accept/decline of a QUOTED quote. */
export const quoteCustomerDecisionSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

export type QuoteCustomerDecisionInput = z.infer<typeof quoteCustomerDecisionSchema>;

/** Query params for GET /api/admin/quotes — filter by status only, same shape as refund requests. */
export const quoteAdminQuerySchema = z.object({
  status: z.nativeEnum(QuoteStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type QuoteAdminQueryInput = z.infer<typeof quoteAdminQuerySchema>;

/**
 * Same inline-vs-saved-address union as `orderCreateSchema` (src/lib/validations/order.ts)
 * — quote-to-order conversion needs a shipping destination exactly like normal
 * checkout does, since it produces a real Order.
 */
const inlineShippingAddressSchema = z.object({
  recipientName: z.string().trim().min(1, { message: "Recipient name is required." }),
  phone: z.string().trim().min(1, { message: "Phone number is required." }),
  line1: z.string().trim().min(1, { message: "Address line is required." }),
  line2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(1, { message: "City is required." }),
  region: z.string().trim().optional().or(z.literal("")),
  postalCode: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().min(1, { message: "Country is required." }),
});

/** Body for POST /api/admin/quotes/[id]/convert. */
export const quoteConvertSchema = z
  .object({
    addressId: z.string().trim().min(1).optional(),
    shippingAddress: inlineShippingAddressSchema.optional(),
  })
  .refine((data) => Boolean(data.addressId) !== Boolean(data.shippingAddress), {
    message: "Provide exactly one of addressId or shippingAddress.",
    path: ["addressId"],
  });

export type QuoteConvertInput = z.infer<typeof quoteConvertSchema>;
