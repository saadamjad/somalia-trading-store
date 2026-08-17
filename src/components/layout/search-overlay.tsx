"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { productService } from "@/lib/services/product-service";
import { formatProductPrice } from "@/lib/utils";

export function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (isSearchOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSearchOpen]);

  const handleClose = () => {
    setQuery("");
    closeSearch();
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeSearch]);

  const suggestions =
    query.length >= 2 ? productService.getSuggestions(query) : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleClose();
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 px-4 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Search Products</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-accent-light"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, category, or SKU..."
            className="pl-10"
          />
        </form>

        {suggestions.length > 0 && (
          <ul className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-border">
            {suggestions.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/shop/${product.category}/${product.slug}`}
                  onClick={handleClose}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent-light"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted">{product.subcategory}</p>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatProductPrice(product.price, product.currency, product.priceUnit)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {query.length >= 2 && suggestions.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted">
            No products found. Try a different search term.
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => {
            if (query.trim()) {
              handleClose();
              router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            }
          }}
        >
          View all results
        </Button>
      </div>
    </div>
  );
}
