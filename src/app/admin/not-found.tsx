import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Without this file, an unmatched /admin/* path falls through to Next's bare
 * default 404 page, which bypasses admin/layout.tsx entirely — no <html>/<body>,
 * fonts, or Providers (same "missing inherited root shell" failure mode as the
 * missing-<html> bug fixed on admin/layout.tsx itself, just for the not-found path).
 * Renders inside admin/layout.tsx as a normal segment (unlike error.tsx, this is
 * not a root-layout replacement), so no <html>/<body> needed here.
 */
export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="label mb-4 block text-accent">404</span>
      <h1 className="font-display text-2xl font-bold md:text-3xl">Page not found</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        The admin page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/admin">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
