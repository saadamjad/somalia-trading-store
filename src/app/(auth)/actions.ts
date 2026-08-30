"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth/auth";
import { authService, EmailAlreadyRegisteredError } from "@/server/services/auth-service";
import { userRepository } from "@/server/repositories/user-repository";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/server/lib/rate-limit";

export type ActionState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

async function isRateLimited(routeKey: string, policy: { limit: number; windowMs: number }) {
  const ip = getClientIp(await headers());
  const result = checkRateLimit(`${routeKey}:${ip}`, policy.limit, policy.windowMs);
  return !result.allowed;
}

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations("auth.errors");

  if (await isRateLimited("login", RATE_LIMITS.login)) {
    return { message: t("rateLimited") };
  }

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
      return { message: t("invalidCredentials") };
    }
    throw error;
  }

  // Admin User Management & RBAC: a staff/admin account created via /admin/users
  // starts with mustChangePassword — send them straight to the forced-change screen
  // instead of the homepage, since the /admin layout's own redirect only fires for
  // requests already inside /admin/* (this is the very first request after sign-in).
  // Looked up directly by the just-validated email rather than via getCurrentSession()
  // — signIn's session cookie isn't guaranteed readable via auth() within this same
  // action invocation.
  const user = await userRepository.findByEmail(validated.data.email.trim().toLowerCase());
  if (user?.mustChangePassword) {
    redirect("/admin/change-password");
  }

  redirect("/");
}

export async function registerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const t = await getTranslations("auth.errors");

  if (await isRateLimited("register", RATE_LIMITS.register)) {
    return { message: t("rateLimited") };
  }

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
      return { errors: { email: [t("emailInUse")] } };
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
  const t = await getTranslations("auth.errors");

  if (await isRateLimited("forgot-password", RATE_LIMITS.forgotPassword)) {
    return { message: t("rateLimited") };
  }

  const validated = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  await authService.requestPasswordReset(validated.data.email);

  // Same message whether or not the account exists.
  return {
    message: t("forgotPasswordSent"),
  };
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const t = await getTranslations("auth.errors");

  if (await isRateLimited("reset-password", RATE_LIMITS.resetPassword)) {
    return { message: t("rateLimited") };
  }

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
    return { message: t("invalidResetToken") };
  }

  redirect("/login");
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
