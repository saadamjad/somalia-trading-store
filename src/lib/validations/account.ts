import { z } from "zod";

/**
 * Profile update: name/phone/email. Email is included here (rather than a separate
 * schema) because it's still a single "edit my profile" form — see
 * account-service.ts for why an email change requires current-password confirmation
 * while name/phone do not.
 */
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, { message: "Name must be at least 2 characters long." }).optional(),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address." }).optional(),
  // Required only when `email` is changing — enforced in the service layer, where the
  // current email is known, rather than here (this schema has no access to it).
  currentPassword: z.string().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

const newPasswordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long." })
  .regex(/[a-zA-Z]/, { message: "Password must contain at least one letter." })
  .regex(/[0-9]/, { message: "Password must contain at least one number." });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Current password is required." }),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
