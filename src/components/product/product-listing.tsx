"use client";

import { useCallback, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import {
  ActiveFilterPills,
  FilterPanel,
} from "@/components/product/filter-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getFiltersForCategory } from "@/config/filters";
import type { ActiveFilters } from "@/lib/types/filter";
import type { CategorySlug, SortOption } from "@/lib/types/product";
import { productService } from "@/lib/services/product-service";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

interface ProductListingProps {
  category: CategorySlug;
  initialSearch?: string;
}

export function ProductListing({ category, initialSearch = "" }: ProductListingProps) {
  const [filters, setFilters] = useState<ActiveFilters>({});
  const [sort, setSort] = useState<SortOption>("featured");
  const [search, setSearch] = useState(initialSearch);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filterDefs = getFiltersForCategory(category);
  const priceRange = productService.queryCategory(category).priceRange;

  const { items, total } = useMemo(() => {
    return productService.queryCategory(category, {
      filters,
      sort,
      search,
      page: 1,
      pageSize: 12,
    });
  }, [category, filters, sort, search]);

  const toggleFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      const current = (prev[key] as string[]) || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: updated };
    });
  }, []);

  const setPriceFilter = useCallback((min: number, max: number) => {
    setFilters((prev) => ({ ...prev, price: [min, max] }));
  }, []);

  const clearFilters = () => {
    setFilters({});
    setSearch("");
  };

  const activeFilterCount = Object.values(filters).filter(
    (v) => v && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  const filterPanelProps = {
    filterDefs,
    filters,
    priceRange,
    activeFilterCount,
    onToggleFilter: toggleFilter,
    onSetPriceFilter: setPriceFilter,
    onClearFilters: clearFilters,
  };

  return (
    <div>
      <div className="mb-10 flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search in category..."
          className="max-w-sm rounded-none border-border-strong"
        />
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-10 border border-border-strong bg-transparent px-3 text-xs uppercase tracking-wider"
            aria-label="Sort products"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">{total} items</span>
        </div>
      </div>

      <div className="flex gap-12">
        <aside className="hidden w-56 shrink-0 lg:block">
          <FilterPanel {...filterPanelProps} />
        </aside>

        <div className="flex-1">
          {activeFilterCount > 0 && (
            <ActiveFilterPills
              filters={filters}
              onToggleFilter={toggleFilter}
            />
          )}

          {items.length === 0 ? (
            <div className="py-24 text-center">
              <p className="font-display mb-2 text-xl font-semibold">
                No products found
              </p>
              <p className="mb-6 text-sm text-muted">
                Try adjusting your filters.
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-12 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-none">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-6 pb-6">
            <FilterPanel {...filterPanelProps} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
