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
  const fullTitle =
    title === brand.name ? title : `${title} | ${brand.name}`;

  return {
    title: fullTitle,
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
