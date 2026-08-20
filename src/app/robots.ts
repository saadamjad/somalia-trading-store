import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/seo";

/**
 * Phase 18: paired with sitemap.ts (also missing since Phase 0's audit). Disallows
 * every authenticated/private area (account, admin, API, auth pages) — none of it is
 * meant to be indexed — and points crawlers at the sitemap for everything that is.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/api", "/login", "/register", "/checkout"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
