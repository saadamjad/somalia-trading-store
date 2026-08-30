"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/motion";
import { resetPasswordAction, type ActionState } from "@/app/(auth)/actions";

function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resetPasswordAction,
    undefined
  );

  return (
    <Card>
      <CardContent className="p-6 md:p-8">
        {!token ? (
          <p role="alert" className="text-sm text-destructive">
            {t.rich("missingToken", {
              link: (chunks) => (
                <Link href="/forgot-password" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : (
          <form action={action} className="space-y-5">
            <input type="hidden" name="token" value={token} />

            {state?.message && (
              <p
                role="alert"
                className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {state.message}
              </p>
            )}

            <div>
              <Label htmlFor="password">{t("newPasswordLabel")}</Label>
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
              <Label htmlFor="confirmPassword">{t("confirmNewPasswordLabel")}</Label>
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
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");

  return (
    <div className="container-custom py-24 md:py-28">
      <FadeIn className="mx-auto max-w-md">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h1 className="font-display mb-4 text-3xl font-bold md:text-4xl">
          {t("title")}
        </h1>
        <p className="mb-8 text-muted">{t("subtitle")}</p>

        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </FadeIn>
    </div>
  );
}
