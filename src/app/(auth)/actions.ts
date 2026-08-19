"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth/auth";
import { authService, EmailAlreadyRegisteredError } from "@/server/services/auth-service";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export type ActionState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: validated.data.email,
      password: validated.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Deliberately generic: never reveal whether the email exists.
      return { message: "Invalid email or password." };
    }
    throw error;
  }

  redirect("/");
}

export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validated = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  try {
    await authService.register(validated.data);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return { errors: { email: [error.message] } };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email: validated.data.email,
      password: validated.data.password,
      redirect: false,
    });
  } catch {
    // Registration succeeded even if the immediate sign-in somehow fails; send the user
    // to log in manually rather than surfacing an error for a successful signup.
    redirect("/login");
  }

  redirect("/");
}

export async function forgotPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validated = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  await authService.requestPasswordReset(validated.data.email);

  // Same message whether or not the account exists.
  return {
    message: "If an account exists for that email, a password reset link has been sent.",
  };
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const validated = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  try {
    await authService.resetPassword(validated.data.token, validated.data.password);
  } catch {
    return { message: "This password reset link is invalid or has expired." };
  }

  redirect("/login");
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
