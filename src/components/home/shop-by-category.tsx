import { CategoryCard } from "@/components/product/category-card";
import { FadeIn } from "@/components/ui/motion";
import { shopByCategoryCopy } from "@/config/home";
import type { Category } from "@/lib/types/product";

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
            {shopByCategoryCopy.description}
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
