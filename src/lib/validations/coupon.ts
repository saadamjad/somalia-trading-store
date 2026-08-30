import { z } from "zod";
import { CouponType } from "@/generated/prisma/client";

/** Body for POST /api/cart/coupon — validates a code against the caller's cart
 * subtotal without redeeming it. `subtotal` here is only a hint for the preview
 * calculation; order-service.ts re-derives the real subtotal server-side from the
 * cart at actual order-creation time and never trusts this value for the real charge. */
export const couponPreviewSchema = z.object({
  code: z.string().trim().min(1, { message: "Coupon code is required." }).max(50),
  subtotal: z.coerce.number().min(0),
});

export type CouponPreviewInput = z.infer<typeof couponPreviewSchema>;

const nullableDecimalField = z.coerce.number().min(0).nullable().optional();
const nullableIntField = z.coerce.number().int().min(0).nullable().optional();

/** Body for POST /api/admin/coupons. */
export const couponCreateSchema = z
  .object({
    code: z.string().trim().min(1, { message: "Code is required." }).max(50),
    type: z.nativeEnum(CouponType),
    value: z.coerce.number().min(0),
    minOrderAmount: nullableDecimalField,
    maxDiscountAmount: nullableDecimalField,
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    usageLimit: nullableIntField,
    perCustomerLimit: nullableIntField,
    active: z.boolean().optional(),
  })
  .refine((data) => data.type !== "PERCENTAGE" || data.value <= 100, {
    message: "A percentage discount can't exceed 100.",
    path: ["value"],
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.startsAt < data.endsAt,
    { message: "Start date must be before end date.", path: ["endsAt"] }
  );

export type CouponCreateInput = z.infer<typeof couponCreateSchema>;

/** Body for PATCH /api/admin/coupons/[id] — same shape, all optional. */
export const couponUpdateSchema = z.object({
  type: z.nativeEnum(CouponType).optional(),
  value: z.coerce.number().min(0).optional(),
  minOrderAmount: nullableDecimalField,
  maxDiscountAmount: nullableDecimalField,
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  usageLimit: nullableIntField,
  perCustomerLimit: nullableIntField,
  active: z.boolean().optional(),
});

export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;
