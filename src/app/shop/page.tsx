import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryCard } from "@/components/product/category-card";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";
import { createPageMetadata } from "@/config/seo";
import { productService } from "@/server/services/product-service";

export const metadata = createPageMetadata({
  title: "Shop Catalogue",
  description: `Browse all product categories at ${brand.name} — construction materials, road interlocks, and fishing products.`,
  path: "/shop",
});

export default async function ShopPage() {
  const categories = await productService.getCategories();

  return (
    <>
      <section className="mesh-light relative overflow-hidden pt-(--header-height)">
        <div className="container-custom relative z-10 py-20 md:py-28">
          <FadeIn>
            <span className="label mb-4 block">Catalogue</span>
            <h1 className="font-display mb-5 max-w-2xl text-4xl font-bold text-foreground md:text-6xl">
              Browse by
              <br />
              <span className="text-accent">Category</span>
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted md:text-base">
              Select a category to explore products — construction materials,
              road interlocks, and fishing products.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="section-padding section-after-hero">
        <div className="container-custom">
          <div className="grid gap-px bg-border md:grid-cols-3">
            {categories.map((category, i) => (
              <FadeIn key={category.slug} delay={i * 0.08}>
                <CategoryCard category={category} index={i} className="h-full min-h-[360px]" />
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.2} className="mt-12 text-center">
            <p className="mb-2 text-sm text-muted">
              Need help choosing? Contact our team directly.
            </p>
            <Link
              href="/about"
              className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:text-accent"
            >
              Get in Touch
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
