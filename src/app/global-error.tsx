"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Catches errors thrown in the root layout itself (error.tsx does not wrap the layout
 * above it in the same segment — see node_modules/next/dist/docs/.../error.md). Must
 * define its own <html>/<body> and import global styles/fonts directly since it
 * replaces the root layout entirely when active. Never render error.message/stack to
 * the user — log server-side/console only, matching src/server/lib/api-errors.ts.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        <section className="flex min-h-screen items-center justify-center px-6 text-center">
          <div className="max-w-xl">
            <span className="label mb-4 block text-accent">Error</span>
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Something went wrong
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
              We hit an unexpected error loading the app. Please try again.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => retry()}
                className="inline-flex h-12 items-center justify-center bg-foreground px-7 text-sm font-semibold text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
              >
                Try Again
              </button>
              {/* Plain <a>, not next/link: this file replaces the root layout entirely, so
                  the app router context it crashed under may not be intact — a hard
                  navigation is the only reliably safe way home from here. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="inline-flex h-12 items-center justify-center border border-border-strong px-7 text-sm font-semibold text-foreground transition-all hover:border-foreground"
              >
                Back to Home
              </a>
            </div>
          </div>
        </section>
      </body>
    </html>
  );
}
