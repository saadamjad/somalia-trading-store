"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Server-side/console logging only — never render error.message or error.stack to
    // the user (matches src/server/lib/api-errors.ts's "never leak internals" philosophy).
    console.error(error);
  }, [error]);

  return (
    <section className="section-padding flex min-h-[70vh] items-center pt-32">
      <div className="container-custom max-w-xl text-center">
        <span className="label mb-4 block text-accent">Error</span>
        <h1 className="font-display text-3xl font-bold md:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
          We hit an unexpected error loading this page. You can try again, or head back
          to the homepage.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" onClick={() => retry()}>
            Try Again
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
