import { z } from "zod";

/**
 * `postalCode` and `region` are optional per docs/IMPLEMENTATION_PLAN.md Phase 6 —
 * Somalia addressing doesn't always use a postal code, and not every address needs a
 * region/state distinct from the city.
 */
export const addressCreateSchema = z.object({
  recipientName: z.string().trim().min(1, { message: "Recipient name is required." }),
  phone: z.string().trim().min(1, { message: "Phone number is required." }),
  line1: z.string().trim().min(1, { message: "Address line is required." }),
  line2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(1, { message: "City is required." }),
  region: z.string().trim().optional().or(z.literal("")),
  postalCode: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().min(1, { message: "Country is required." }),
  isDefault: z.boolean().optional(),
});

export const addressUpdateSchema = addressCreateSchema.partial();

export type AddressCreateInput = z.infer<typeof addressCreateSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
