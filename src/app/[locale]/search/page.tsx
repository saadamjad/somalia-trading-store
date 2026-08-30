import Link from "next/link";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createPageMetadata } from "@/config/seo";
import { isLocale, defaultLocale } from "@/config/i18n";
import { productService } from "@/server/services/product-service";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return createPageMetadata({
    title: "Search Products",
    description: "Search our product catalogue across construction, road interlocks, and fishing products.",
    path: "/search",
    locale,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await productService.search(query) : [];
  const t = await getTranslations("shop.search");

  return (
    <div className="container-custom py-24 md:py-28">
      <h1 className="font-display mb-2 text-3xl font-bold md:text-4xl">
        {t("title")}
      </h1>

      {!query ? (
        <div className="min-h-[40vh]">
          <EmptyState
            icon={Search}
            title={t("emptyPrompt")}
            action={
              <Button asChild>
                <Link href="/shop">{t("browseCatalogue")}</Link>
              </Button>
            }
          />
        </div>
      ) : results.length === 0 ? (
        <div className="min-h-[40vh]">
          <EmptyState
            icon={Search}
            title={t("noResults", { query })}
            description={t("noResultsDescription")}
            action={
              <Button asChild variant="outline">
                <Link href="/shop">{t("browseAll")}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <p className="mb-8 text-muted">
            {t("resultCount", { count: results.length, query })}
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
