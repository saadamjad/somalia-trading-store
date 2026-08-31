import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/product/product-card";
import { SectionHeader } from "@/components/ui/section-header";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/motion";
import type { Product } from "@/lib/types/product";

/**
 * Real product photos + prices on the homepage — the site's only such section.
 * Sourced from productService.getFeatured() (admin-flagged `featured` products);
 * renders nothing if none are flagged so a fresh/unseeded deploy stays safe.
 */
export async function FeaturedProductsSection({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  const t = await getTranslations("home.featured");

  return (
    <section className="section-padding bg-background">
      <div className="container-custom">
        <FadeIn className="section-heading flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader eyebrow={t("eyebrow")} title={t("title")} />
          <Link
            href="/shop"
            className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:text-accent-text"
          >
            {t("shopAll")}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
          </Link>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
          {products.map((product) => (
            <StaggerItem key={product.id}>
              <ProductCard product={product} variant="grid" />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
