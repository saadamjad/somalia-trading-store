"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { FadeIn } from "@/components/ui/motion";
import { loginAction, type ActionState } from "@/app/(auth)/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    loginAction,
    undefined
  );

  return (
    <div className="container-custom py-24 md:py-28">
      <FadeIn className="mx-auto max-w-md">
        <span className="eyebrow">Welcome Back</span>
        <h1 className="font-display mb-4 text-3xl font-bold md:text-4xl">
          Log In
        </h1>
        <p className="mb-8 text-muted">
          Log in to your account to manage orders, quotes, and your wishlist.
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

              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1.5"
                />
                {state?.errors?.password && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {state.errors.password[0]}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Logging in..." : "Log In"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
