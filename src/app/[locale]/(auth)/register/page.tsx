"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/motion";
import { registerAction, type ActionState } from "@/app/[locale]/(auth)/actions";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    registerAction,
    undefined
  );

  return (
    <div className="container-custom py-24 md:py-28">
      <FadeIn className="mx-auto max-w-md">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="font-display mb-4 text-3xl font-bold md:text-4xl">
          {t("title")}
        </h1>
        <p className="mb-8 text-muted">
          {t("subtitle")}
        </p>

        <Card>
          <CardContent className="p-6 md:p-8">
            <form action={action} className="space-y-5">
              {state?.message && (
                <p
                  role="alert"
                  className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {state.message}
                </p>
              )}

              <div>
                <Label htmlFor="name">{t("nameLabel")}</Label>
                <Input id="name" name="name" required className="mt-1.5" />
                {state?.errors?.name && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {state.errors.name[0]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="email">{t("emailLabel")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1.5"
                />
                {state?.errors?.email && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {state.errors.email[0]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">{t("phoneLabel")}</Label>
                <Input id="phone" name="phone" type="tel" className="mt-1.5" />
                {state?.errors?.phone && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {state.errors.phone[0]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1.5"
                />
                {state?.errors?.password && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-destructive">
                    {state.errors.password.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="mt-1.5"
                />
                {state?.errors?.confirmPassword && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {state.errors.confirmPassword[0]}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? t("submitting") : t("submit")}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              {t("haveAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {t("logIn")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
