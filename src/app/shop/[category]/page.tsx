import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product/product-listing";
import { CategoryBanner } from "@/components/product/category-banner";
import { createPageMetadata } from "@/config/seo";
import { productService } from "@/server/services/product-service";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateStaticParams() {
  const categories = await productService.getCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = await productService.getCategory(slug);
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
  const category = await productService.getCategory(slug);

  if (!category) notFound();

  const { total } = await productService.queryCategory(slug);

  return (
    <>
      <CategoryBanner category={category} productCount={total} />

      <section className="section-padding section-after-hero">
        <div className="container-custom">
          <ProductListing
            category={slug}
            initialSearch={q ?? ""}
          />
        </div>
      </section>
    </>
  );
}
