import { z } from "zod";

/**
 * Same shape as `addressCreateSchema` (src/lib/validations/address.ts) minus
 * `isDefault` — an inline checkout address is a one-off shipping snapshot, not
 * necessarily saved to the customer's address book.
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

/**
 * Body for POST /api/orders. Deliberately contains NO price, quantity, or product
 * data — the server always re-reads the caller's own cart and re-prices every line
 * from the current Product rows at order-creation time (see order-service.ts
 * `createOrder`). This is not "ignoring" a client-supplied price/quantity — the API
 * shape never accepts one at all, which is the stronger guarantee (cross-cutting
 * standards, docs/IMPLEMENTATION_PLAN.md).
 *
 * Exactly one of `addressId` (an existing saved address, ownership-checked
 * server-side) or `shippingAddress` (an inline one-off address) must be supplied.
 */
export const orderCreateSchema = z
  .object({
    addressId: z.string().trim().min(1).optional(),
    shippingAddress: inlineShippingAddressSchema.optional(),
    customerNote: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.addressId) !== Boolean(data.shippingAddress), {
    message: "Provide exactly one of addressId or shippingAddress.",
    path: ["addressId"],
  });

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type InlineShippingAddressInput = z.infer<typeof inlineShippingAddressSchema>;
