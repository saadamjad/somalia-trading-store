import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryCard } from "@/components/product/category-card";
import { ProductCard } from "@/components/product/product-card";
import { FadeIn } from "@/components/ui/motion";
import { productService } from "@/lib/services/product-service";

export function ShopByCategory() {
  const categories = productService.getCategories();

  return (
    <section className="section-padding section-after-hero bg-background">
      <div className="container-custom">
        <FadeIn className="section-heading flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="label mb-4 block">Catalogue</span>
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              Shop by
              <br />
              Category
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            Construction materials, road interlocks, and fishing products —
            three specialised supply divisions.
          </p>
        </FadeIn>

        <div className="grid gap-px bg-border md:grid-cols-3">
          {categories.map((category, i) => (
            <FadeIn key={category.slug} delay={i * 0.08}>
              <CategoryCard category={category} index={i} className="h-full" />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedProducts() {
  const products = productService.getFeatured();

  return (
    <section className="section-padding section-after-band bg-background">
      <div className="container-custom">
        <FadeIn className="section-heading flex items-end justify-between">
          <div>
            <span className="label mb-4 block">Selected</span>
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              Featured
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted transition-colors hover:text-foreground sm:inline-flex"
          >
            All Products
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </FadeIn>

        <div className="space-y-px bg-border">
          {products.map((product, i) => (
            <FadeIn key={product.id} delay={i * 0.1}>
              <ProductCard product={product} variant="editorial" />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
