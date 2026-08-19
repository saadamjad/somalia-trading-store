"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/motion";
import { forgotPasswordAction, type ActionState } from "@/app/(auth)/actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    forgotPasswordAction,
    undefined
  );

  return (
    <div className="container-custom py-24 md:py-28">
      <FadeIn className="mx-auto max-w-md">
        <span className="eyebrow">Account Recovery</span>
        <h1 className="font-display mb-4 text-3xl font-bold md:text-4xl">
          Forgot Password
        </h1>
        <p className="mb-8 text-muted">
          Enter the email associated with your account and we&apos;ll send you a
          link to reset your password.
        </p>

        <Card>
          <CardContent className="p-6 md:p-8">
            {state?.message ? (
              <p role="status" className="text-sm text-foreground">
                {state.message}
              </p>
            ) : (
              <form action={action} className="space-y-5">
                <div>
                  <Label htmlFor="email">Email *</Label>
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

                <Button type="submit" className="w-full" disabled={pending}>
                  {pending ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-muted">
              Remembered your password?{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
