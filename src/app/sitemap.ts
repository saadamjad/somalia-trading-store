import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/seo";
import { productService } from "@/server/services/product-service";

/**
 * Phase 18: flagged missing in the original Phase 0 audit (docs/PROJECT_AUDIT.md §3,
 * §11) and never added along the way — cheap to add now. Covers every public,
 * indexable route: static marketing pages plus every real product/category page,
 * generated from the DB (not the old hardcoded 3-product array).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/shop`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/quote`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/faq`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const products = await productService.getAll();

  const categorySlugs = Array.from(new Set(products.map((p) => p.category)));
  const categoryRoutes: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${baseUrl}/shop/${slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/shop/${product.category}/${product.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
