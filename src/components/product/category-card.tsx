"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Category } from "@/lib/types/product";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";

interface CategoryCardProps {
  category: Category;
  index?: number;
  variant?: "default" | "large";
  className?: string;
}

export function CategoryCard({
  category,
  index = 0,
  variant = "default",
  className,
}: CategoryCardProps) {
  const t = useTranslations("shop.categoryCard");

  return (
    <Link
      href={`/shop/${category.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden border border-border bg-surface transition-all duration-500 hover:-translate-y-1 hover:border-border-strong hover:shadow-(--shadow-lg)",
        className
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted/10",
          variant === "large" ? "aspect-[4/3]" : "aspect-square"
        )}
      >
        <SafeImage
          src={category.image}
          alt={category.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col p-7 md:p-9">
        <span className="label mb-3 block">{t("categoryIndex", { index: index + 1 })}</span>
        <h3 className="font-display mb-3 text-2xl font-bold text-foreground md:text-3xl">
          {category.name}
        </h3>
        <p className="mb-6 max-w-xs text-sm leading-relaxed text-muted">
          {category.shortDescription}
        </p>
        <span className="mt-auto inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent-text transition-all group-hover:gap-3">
          {t("viewProducts")}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
