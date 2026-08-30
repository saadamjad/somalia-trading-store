import { brand } from "./brand";
import { locales, defaultLocale, type Locale } from "./i18n";

export const siteConfig = {
  name: brand.name,
  description: brand.description,
  url: "https://somalia-trading.com", // EDIT: Update with production URL
} as const;

export function createPageMetadata({
  title,
  description,
  path = "",
  locale = defaultLocale,
  /**
   * Per-locale equivalents of `path` when they differ (e.g. a localized product
   * slug — requirement §22/§42: each localized page must canonicalize to its OWN
   * URL, never all languages folded into the English one). Keyed by locale; a
   * locale missing from this map falls back to `path` unchanged. Only needed when
   * the path actually differs per locale — most static pages can omit it.
   */
  localizedPaths,
}: {
  title: string;
  description: string;
  path?: string;
  locale?: Locale;
  localizedPaths?: Partial<Record<Locale, string>>;
}) {
  // The locale layout (src/app/[locale]/layout.tsx) already defines a title
  // TEMPLATE (`%s | ${brand.name}`) that Next.js automatically applies to every
  // page's title. Appending `| brand.name` here too produced a doubled suffix in
  // the rendered <title> tag on every page using this helper (e.g. "Product Name |
  // Foley General Trading (LLC) | Foley General Trading (LLC)") — found via a
  // production-readiness SEO audit, verified against real rendered HTML across
  // 13 page types. `title` is passed through as-is (bare, no suffix) so the
  // layout's template supplies it exactly once. `openGraph.title` DOES need the
  // explicit full brand suffix — Open Graph has no template mechanism of its
  // own, and social platforms render `og:title` independent of <title>.
  const fullTitle = `${title} | ${brand.name}`;

  const pathFor = (l: Locale) => localizedPaths?.[l] ?? path;
  const urlFor = (l: Locale) => `${siteConfig.url}/${l}${pathFor(l)}`;

  // hreflang for every supported locale plus x-default -> the default locale's own
  // URL (requirement §38: "x-default must point to the correct default experience"
  // — never a bare, locale-less URL, since every route is locale-prefixed).
  const languages: Record<string, string> = { "x-default": urlFor(defaultLocale) };
  for (const l of locales) {
    languages[l] = urlFor(l);
  }

  return {
    title,
    description,
    alternates: {
      canonical: urlFor(locale),
      languages,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: urlFor(locale),
      siteName: brand.name,
      type: "website" as const,
    },
  };
}
