"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { Category } from "@/lib/types/product";
import { getCategoryBannerConfig } from "@/config/category-banners";

interface CategoryBannerProps {
  category: Category;
  productCount: number;
}

export function CategoryBanner({ category, productCount }: CategoryBannerProps) {
  const config = getCategoryBannerConfig(category);
  const shouldReduceMotion = useReducedMotion();
  const ease = [0.16, 1, 0.3, 1] as const;
  const words = category.name.split(" ");

  return (
    <section className="mesh-light relative overflow-hidden pt-(--header-height)">
      <div className="container-custom relative z-10 py-16 md:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
            className="lg:col-span-5"
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="label">{config.eyebrow}</span>
              <span className="hidden h-px w-10 bg-accent/40 sm:block" />
            </div>

            <h1 className="font-display mb-5 text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[0.95] tracking-tight text-foreground">
              {words.map((word, i) => (
                <span
                  key={`${word}-${i}`}
                  className={i === config.accentWordIndex ? "text-accent" : ""}
                >
                  {word}{" "}
                </span>
              ))}
            </h1>

            <p className="mb-8 max-w-md text-sm leading-relaxed text-muted md:text-base">
              {category.description}
            </p>

            <div className="mb-10 flex flex-wrap gap-2">
              {category.subcategories.slice(0, 5).map((sub) => (
                <span
                  key={sub}
                  className="border border-border bg-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  {sub}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-px border border-border bg-border">
              {config.highlights.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-start gap-2 bg-surface px-4 py-4"
                >
                  <Icon className="h-4 w-4 text-accent" strokeWidth={1.5} />
                  <span className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease }}
            className="lg:col-span-7"
          >
            <div className="grid min-h-85 grid-cols-12 grid-rows-6 gap-2.5 md:min-h-105 md:gap-3">
              <div className="group relative col-span-12 row-span-4 overflow-hidden border border-border bg-muted/10 sm:col-span-8 sm:row-span-6">
                <Image
                  src={config.images.primary.src}
                  alt={config.images.primary.alt}
                  fill
                  priority
                  sizes="(max-width: 640px) 100vw, 55vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                {config.images.primary.featured && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <span className="label mb-1 block text-accent">
                        {config.images.primary.featuredLabel}
                      </span>
                      <p className="font-display text-sm font-semibold text-white md:text-base">
                        {config.images.primary.featuredTitle}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="group relative col-span-6 row-span-2 overflow-hidden border border-border bg-muted/10 sm:col-span-4 sm:row-span-3">
                <Image
                  src={config.images.secondary.src}
                  alt={config.images.secondary.alt}
                  fill
                  sizes="25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>

              <div className="group relative col-span-6 row-span-2 overflow-hidden border border-border bg-muted/10 sm:col-span-4 sm:row-span-3">
                <Image
                  src={config.images.tertiary.src}
                  alt={config.images.tertiary.alt}
                  fill
                  sizes="25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 border-t border-border">
        <div className="container-custom flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {productCount} product{productCount !== 1 ? "s" : ""} in catalogue
          </span>
          {config.footerColors ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {config.footerColors.map(({ label, color }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {label}
                </span>
              ))}
            </div>
          ) : (
            config.footerTags && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {config.footerTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
