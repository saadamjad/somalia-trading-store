import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="section-padding flex min-h-[70vh] items-center pt-32">
      <div className="container-custom max-w-xl text-center">
        <span className="label mb-4 block text-accent">404</span>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Page not found</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved. Check the
          address, or head back to the homepage or shop.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/">Back to Home</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/shop">Browse Shop</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
