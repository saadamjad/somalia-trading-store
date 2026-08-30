import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/seo";
import { locales } from "@/config/i18n";

/**
 * Phase 18: paired with sitemap.ts (also missing since Phase 0's audit). Disallows
 * every authenticated/private area (account, admin, API, auth pages) — none of it is
 * meant to be indexed — and points crawlers at the sitemap for everything that is.
 *
 * i18n: /account, /login etc. now live under a locale prefix (/en/account, /so/account
 * — see middleware.ts), so each disallow path is repeated per locale. /admin and /api
 * stay unprefixed (excluded from locale routing).
 */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = ["/account", "/login", "/register", "/checkout"];
  const disallow = [
    "/admin",
    "/api",
    ...locales.flatMap((locale) => privatePaths.map((path) => `/${locale}${path}`)),
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
