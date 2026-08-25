"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { heroFallback } from "@/config/home";
import { SafeImage } from "@/components/ui/safe-image";
import type { Category } from "@/lib/types/product";

export interface HeroBanner {
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  linkUrl: string | null;
}

interface HeroSectionProps {
  categories: Category[];
  /**
   * Admin-managed override for the headline/subtext/CTA, sourced from the active
   * `Banner` in the `HOMEPAGE_HERO` slot (see src/app/page.tsx). `null`/`undefined`
   * (no active banner configured) falls back to the original static approved copy
   * below, unchanged — an empty Banner table must never break the homepage.
   */
  banner?: HeroBanner | null;
}

export function HeroSection({ categories, banner }: HeroSectionProps) {
  return (
    <section className="mesh-light relative min-h-screen overflow-hidden pt-(--header-height)">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(12,12,12,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(12,12,12,0.5) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="container-custom relative z-10 flex min-h-screen flex-col justify-end pb-16 pt-32 lg:pb-24 lg:pt-40">
        <div className="grid items-end gap-12 lg:grid-cols-12 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <div className="mb-8 flex items-center gap-4">
              <span className="label text-accent">{brand.shortName}</span>
              <span className="hidden h-px w-12 bg-accent/40 sm:block" />
            </div>

            {banner ? (
              <h1 className="font-display text-balance mb-8 text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-tight text-foreground">
                {banner.title}
              </h1>
            ) : (
              <h1 className="font-display text-balance mb-8 text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-tight text-foreground">
                {heroFallback.headlineLine1}
                <br />
                <span className="text-accent">{heroFallback.headlineAccent}</span>
                <br />
                {heroFallback.headlineLine3}
              </h1>
            )}

            <p className="mb-10 max-w-lg text-base leading-relaxed text-muted md:text-lg">
              {banner?.subtitle || brand.description}
            </p>

            <Button asChild size="lg" variant="accent">
              <Link href={banner?.linkUrl || "/shop"}>
                {banner?.ctaText || "Explore Catalogue"}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5"
          >
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat, i) => (
                <Link
                  key={cat.slug}
                  href={`/shop/${cat.slug}`}
                  className={`group relative overflow-hidden border border-border bg-muted/10 ${
                    i === 0 ? "col-span-2 aspect-[16/7]" : "aspect-square"
                  }`}
                >
                  <SafeImage
                    src={cat.image}
                    alt={cat.name}
                    fill
                    priority={i === 0}
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                    <span className="label mb-1 block text-accent">
                      0{i + 1}
                    </span>
                    <p className="font-display text-sm font-semibold text-white md:text-base">
                      {cat.name}
                    </p>
                  </div>
                  <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-white/0 transition-all duration-300 group-hover:text-white" />
                </Link>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4"
        >
          {[
            { label: "Industries", value: "3" },
            { label: "Categories", value: "Supply" },
            { label: "Market", value: "Somalia" },
            { label: "Focus", value: "Quality" },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface px-6 py-5">
              <p className="font-display text-2xl font-bold text-foreground md:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
