import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product/product-listing";
import { CategoryBanner } from "@/components/product/category-banner";
import { createPageMetadata } from "@/config/seo";
import { productService } from "@/lib/services/product-service";
import type { CategorySlug } from "@/lib/types/product";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateStaticParams() {
  return productService.getCategories().map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = productService.getCategory(slug);
  if (!category) return {};
  return createPageMetadata({
    title: category.name,
    description: category.description,
    path: `/shop/${slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category: slug } = await params;
  const { q } = await searchParams;
  const category = productService.getCategory(slug);

  if (!category) notFound();

  const { total } = productService.queryCategory(slug as CategorySlug);

  return (
    <>
      <CategoryBanner category={category} productCount={total} />

      <section className="section-padding section-after-hero">
        <div className="container-custom">
          <ProductListing
            category={slug as CategorySlug}
            initialSearch={q ?? ""}
          />
        </div>
      </section>
    </>
  );
}
