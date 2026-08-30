import { brand } from "./brand";

export const siteConfig = {
  name: brand.name,
  description: brand.description,
  url: "https://somalia-trading.com", // EDIT: Update with production URL
} as const;

export function createPageMetadata({
  title,
  description,
  path = "",
}: {
  title: string;
  description: string;
  path?: string;
}) {
  // The root layout (src/app/layout.tsx) already defines a title TEMPLATE
  // (`%s | ${brand.name}`) that Next.js automatically applies to every page's
  // title. Appending `| brand.name` here too produced a doubled suffix in the
  // rendered <title> tag on every page using this helper (e.g. "Product Name |
  // Foley General Trading (LLC) | Foley General Trading (LLC)") — found via a
  // production-readiness SEO audit, verified against real rendered HTML across
  // 13 page types. `title` is passed through as-is (bare, no suffix) so the
  // layout's template supplies it exactly once. `openGraph.title` DOES need the
  // explicit full brand suffix — Open Graph has no template mechanism of its
  // own, and social platforms render `og:title` independent of <title>.
  const fullTitle = `${title} | ${brand.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteConfig.url}${path}`,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: `${siteConfig.url}${path}`,
      siteName: brand.name,
      type: "website" as const,
    },
  };
}
