import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryCard } from "@/components/product/category-card";
import { ProductCard } from "@/components/product/product-card";
import { FadeIn } from "@/components/ui/motion";
import type { Category, Product } from "@/lib/types/product";

export function ShopByCategory({ categories }: { categories: Category[] }) {
  return (
    <section className="section-padding section-after-hero bg-background">
      <div className="container-custom">
        <FadeIn className="section-heading flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="label">Catalogue</span>
              <span className="h-px w-10 bg-accent/40" />
            </div>
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              Shop by
              <br />
              <span className="text-accent">Category</span>
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

export function FeaturedProducts({ products }: { products: Product[] }) {
  return (
    <section className="section-padding section-after-band bg-background">
      <div className="container-custom">
        <FadeIn className="section-heading flex items-end justify-between">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="label">Selected</span>
              <span className="h-px w-10 bg-accent/40" />
            </div>
            <h2 className="font-display text-4xl font-bold md:text-5xl">
              <span className="text-accent">Featured</span>
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
