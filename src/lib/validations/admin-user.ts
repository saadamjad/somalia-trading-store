import { z } from "zod";

// Same policy as registerSchema's password (src/lib/validations/auth.ts) — reused
// verbatim, not redefined, so a temp password an admin sets manually satisfies the
// exact same rule the forced-change screen will apply.
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long." })
  .regex(/[a-zA-Z]/, { message: "Password must contain at least one letter." })
  .regex(/[0-9]/, { message: "Password must contain at least one number." });

export const adminUserCreateSchema = z.object({
  name: z.string().trim().min(2, { message: "Name must be at least 2 characters long." }),
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address." }),
  phone: z.string().trim().optional().or(z.literal("")),
  roleId: z.string().trim().min(1, { message: "Select a role." }),
  password: passwordSchema.optional(),
});

export const adminUserUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().nullable().optional(),
  roleId: z.string().trim().min(1).optional(),
});

export const adminUserStatusSchema = z.object({
  active: z.boolean(),
});

export const adminUserResetPasswordSchema = z.object({
  password: passwordSchema.optional(),
});

export const adminUserListQuerySchema = z.object({
  role: z.enum(["staff", "admin", "super_admin"]).optional(),
  active: z.coerce.boolean().optional(),
});

export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
