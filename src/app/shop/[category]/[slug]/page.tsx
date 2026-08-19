import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product/product-detail-client";
import { createPageMetadata, siteConfig } from "@/config/seo";
import { productService } from "@/server/services/product-service";

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

  const [relatedProducts, categoryData] = await Promise.all([
    productService.getRelated(product),
    productService.getCategory(product.category),
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
      />
    </>
  );
}
