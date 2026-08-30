import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product/product-detail-client";
import { createPageMetadata, siteConfig } from "@/config/seo";
import { productService } from "@/server/services/product-service";
import { reviewService } from "@/server/services/review-service";
import { productVariantService } from "@/server/services/product-variant-service";

interface ProductPageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateStaticParams() {
  const products = await productService.getAll();
  return products.map((p) => ({
    category: p.category,
    slug: p.slug,
  }));
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { category, slug } = await params;
  const product = await productService.getBySlug(category, slug);
  if (!product) return {};
  return createPageMetadata({
    title: product.name,
    description: product.shortDescription,
    path: `/shop/${category}/${slug}`,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { category, slug } = await params;
  const product = await productService.getBySlug(category, slug);

  if (!product) notFound();

  const [relatedProducts, categoryData, reviewSummary, variants] = await Promise.all([
    productService.getRelated(product),
    productService.getCategory(product.category),
    reviewService.listApprovedForProduct(product.id),
    productVariantService.listActiveForProduct(product.id),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.images[0],
    sku: product.sku,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability:
        product.availability === "in_stock"
          ? "https://schema.org/InStock"
          : "https://schema.org/PreOrder",
      url: `${siteConfig.url}/shop/${category}/${slug}`,
    },
    // Only included when real, approved reviews exist — structured data must match
    // what's actually visible on the page (never a fabricated/default rating).
    ...(reviewSummary.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewSummary.averageRating,
            reviewCount: reviewSummary.count,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient
        product={product}
        related={relatedProducts}
        categoryName={categoryData?.name ?? product.category}
        variants={variants}
      />
    </>
  );
}
