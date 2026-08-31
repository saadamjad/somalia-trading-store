import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/seo";
import { productService } from "@/server/services/product-service";
import { locales } from "@/config/i18n";

/**
 * Phase 18: flagged missing in the original Phase 0 audit (docs/PROJECT_AUDIT.md §3,
 * §11) and never added along the way — cheap to add now. Covers every public,
 * indexable route: static marketing pages plus every real product/category page,
 * generated from the DB (not the old hardcoded 3-product array).
 *
 * i18n: every route now exists once per locale (locale-prefixed routing, see
 * middleware.ts). Full hreflang alternates land in Phase 4 — this just makes sure
 * both /en and /so URLs are listed so crawlers can discover them (requirement §41).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  const staticPaths = ["/", "/about", "/shop", "/quote", "/faq"];
  const products = await productService.getAll();
  const categorySlugs = Array.from(new Set(products.map((p) => p.category)));

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of staticPaths) {
      entries.push({
        url: `${baseUrl}/${locale}${path === "/" ? "" : path}`,
        changeFrequency: "weekly",
        priority: path === "/" ? 1 : path === "/shop" ? 0.9 : 0.5,
      });
    }
    for (const slug of categorySlugs) {
      entries.push({
        url: `${baseUrl}/${locale}/shop/${slug}`,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    for (const product of products) {
      entries.push({
        url: `${baseUrl}/${locale}/shop/${product.category}/${product.slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return entries;
}
