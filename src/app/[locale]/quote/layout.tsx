import { createPageMetadata } from "@/config/seo";
import { brand } from "@/config/brand";
import { isLocale, defaultLocale } from "@/config/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return createPageMetadata({
    title: "Request a Quote",
    description:
      `Request a custom quote for construction materials, road interlocks, or fishing products from ${brand.name}.`,
    path: "/quote",
    locale,
  });
}

export default function QuoteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
