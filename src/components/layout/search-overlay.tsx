"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import type { Product } from "@/lib/types/product";
import { formatProductPrice } from "@/lib/utils";

export function SearchOverlay() {
  const t = useTranslations("common");
  const { isSearchOpen, closeSearch } = useUIStore();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
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

  const handleClose = useCallback(() => {
    setQuery("");
    closeSearch();
  }, [closeSearch]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  useEffect(() => {
    if (query.length < 2) return;
    let cancelled = false;
    const params = new URLSearchParams({ q: query, suggest: "true", limit: "6" });
    fetch(`/api/products?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { items: Product[] }) => {
        if (!cancelled) setSuggestions(data.items);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Derived so a short query (< 2 chars) never renders stale suggestions from a
  // previous, longer query without needing an extra setState "reset" in the effect.
  const visibleSuggestions = query.length >= 2 ? suggestions : [];

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
      <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-(--shadow-elevated)">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t("search.title")}</h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-accent-light"
            aria-label={t("aria.closeSearch")}
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
            placeholder={t("search.placeholder")}
            className="pl-10"
          />
        </form>

        {visibleSuggestions.length > 0 && (
          <ul className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-border">
            {visibleSuggestions.map((product) => (
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

        {query.length >= 2 && visibleSuggestions.length === 0 && (
          <p className="mt-4 text-center text-sm text-muted">
            {t("search.noResults")}
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
          {t("search.viewAllResults")}
        </Button>
      </div>
    </div>
  );
}
