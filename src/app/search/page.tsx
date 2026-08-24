import Link from "next/link";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createPageMetadata } from "@/config/seo";
import { productService } from "@/server/services/product-service";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const metadata = createPageMetadata({
  title: "Search Products",
  description: "Search our product catalogue across construction, road interlocks, and fishing products.",
  path: "/search",
});

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await productService.search(query) : [];

  return (
    <div className="container-custom py-24 md:py-28">
      <h1 className="font-display mb-2 text-3xl font-bold md:text-4xl">
        Search Results
      </h1>

      {!query ? (
        <div className="min-h-[40vh]">
          <EmptyState
            icon={Search}
            title="Enter a search term to find products."
            action={
              <Button asChild>
                <Link href="/shop">Browse Catalogue</Link>
              </Button>
            }
          />
        </div>
      ) : results.length === 0 ? (
        <div className="min-h-[40vh]">
          <EmptyState
            icon={Search}
            title={`No results for "${query}"`}
            description="Try different keywords or browse our categories."
            action={
              <Button asChild variant="outline">
                <Link href="/shop">Browse All Products</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <p className="mb-8 text-muted">
            {results.length} result{results.length !== 1 ? "s" : ""} for
            &ldquo;{query}&rdquo;
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
