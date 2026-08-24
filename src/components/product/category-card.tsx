"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Category } from "@/lib/types/product";
import { cn } from "@/lib/utils";

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
  return (
    <Link
      href={`/shop/${category.slug}`}
      className={cn(
        "group relative flex flex-col justify-end overflow-hidden bg-dark-surface transition-all duration-500",
        variant === "large" ? "min-h-[420px]" : "min-h-[320px]",
        className
      )}
    >
      <Image
        src={category.image}
        alt={category.name}
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover opacity-40 transition-all duration-700 group-hover:scale-[1.03] group-hover:opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      <div className="relative bg-black/80 p-7 backdrop-blur-sm md:p-9">
        <span className="label mb-3 block text-accent">
          Category 0{index + 1}
        </span>
        <h3 className="font-display mb-3 text-2xl font-bold text-white md:text-3xl">
          {category.name}
        </h3>
        <p className="mb-6 max-w-xs text-sm leading-relaxed text-white/70">
          {category.shortDescription}
        </p>
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent transition-all group-hover:gap-3">
          View Products
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
