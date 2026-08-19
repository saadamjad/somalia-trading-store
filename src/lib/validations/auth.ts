import { z } from "zod";

// Shared password policy: minimum length + a mix of character classes. Applied on both
// client and server (server is authoritative; client-side is UX only).
const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters long." })
  .regex(/[a-zA-Z]/, { message: "Password must contain at least one letter." })
  .regex(/[0-9]/, { message: "Password must contain at least one number." });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, { message: "Name must be at least 2 characters long." }),
    email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address." }),
    phone: z.string().trim().optional().or(z.literal("")),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address." }),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: "Missing reset token." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
