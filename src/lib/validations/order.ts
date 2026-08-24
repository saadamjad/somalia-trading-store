import { z } from "zod";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/client";

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

/**
 * Body for POST /api/orders when there is no session (guest checkout). The client's
 * cart lives only in localStorage for a guest (cart-store.ts) — there is no server
 * cart to read from — so `items` here is the guest's local cart contents. Same
 * no-price/no-quantity-trust guarantee as the authenticated path still holds: `items`
 * only carries productId + quantity, never a price, and order-service.ts re-prices
 * every line from the current Product rows before creating the order.
 */
export const guestOrderCreateSchema = z.object({
  email: z.string().trim().email({ message: "A valid email is required." }),
  name: z.string().trim().min(1, { message: "Name is required." }),
  shippingAddress: inlineShippingAddressSchema,
  customerNote: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, { message: "Your cart is empty." }),
});

export type GuestOrderCreateInput = z.infer<typeof guestOrderCreateSchema>;

/**
 * Phase 9: customer-facing order-history filter — `/account/orders?status=...`. A
 * customer may filter their OWN orders by status; there is deliberately no equivalent
 * for paymentStatus here (spec §5 — order status and payment status are kept as
 * separate concerns throughout; the admin query schema below is where paymentStatus
 * filtering belongs, since only admins act on payment state).
 */
export const orderCustomerQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
});

/**
 * Body for PATCH /api/admin/orders/[id]. `status` (with optional `note`) and
 * `internalNote` are independent, optional operations — either or both may be supplied
 * in one request, but at least one must be present. Never accepts `paymentStatus` —
 * there is no request field, anywhere in this schema, that can change it (spec §5 hard
 * requirement; see order-service.ts `updateStatus`).
 */
export const orderAdminUpdateSchema = z
  .object({
    status: z.nativeEnum(OrderStatus).optional(),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
    internalNote: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine((data) => data.status !== undefined || data.internalNote !== undefined, {
    message: "Provide at least one of status or internalNote.",
    path: ["status"],
  });

export type OrderAdminUpdateInput = z.infer<typeof orderAdminUpdateSchema>;

const ADMIN_ORDER_SORT_FIELDS = ["createdAt", "total", "orderNumber"] as const;

/**
 * Query params for GET /api/admin/orders. All fields optional; `page`/`pageSize` are
 * coerced from strings (URLSearchParams) with sane bounds so a malformed/absent value
 * never produces an unbounded or negative query.
 */
export const orderAdminQuerySchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  orderNumber: z.string().trim().min(1).optional(),
  customer: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(ADMIN_ORDER_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type OrderAdminQueryInput = z.infer<typeof orderAdminQuerySchema>;
