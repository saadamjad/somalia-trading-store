"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
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

const AUTOPLAY_MS = 2000;

/**
 * Full-bleed promotional slider built from the homepage's already-fetched category
 * list — one slide per division. Autoplays, pauses on hover/focus, and honours
 * prefers-reduced-motion. Falls back to a single static panel if categories is
 * empty so a fresh/unseeded deploy never renders broken slider chrome.
 */
function CategorySlider({ categories }: { categories: Category[] }) {
  const t = useTranslations("home.hero");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slideCount = categories.length;

  useEffect(() => {
    if (slideCount <= 1 || isPaused || prefersReducedMotion) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % slideCount);
    }, AUTOPLAY_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slideCount, isPaused, prefersReducedMotion]);

  if (slideCount === 0) return null;

  // Clamped defensively in case slideCount ever shrinks between renders (categories
  // is static server-fetched data today, but this keeps the component crash-safe if
  // that ever changes) rather than indexing out of bounds into `undefined`.
  const active = categories[Math.min(activeIndex, slideCount - 1)];

  const goTo = (index: number) => setActiveIndex(((index % slideCount) + slideCount) % slideCount);
  const goPrev = () => goTo(activeIndex - 1);
  const goNext = () => goTo(activeIndex + 1);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t("kicker")}
      className="group relative aspect-4/5 w-full overflow-hidden border border-border bg-muted/10 sm:aspect-16/11 lg:aspect-4/5"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        // Only unpause once focus actually leaves the whole slider — tabbing between
        // its own prev/next/dot buttons fires blur+focus in succession on this same
        // container, and without this check that pair would tear down and restart
        // the autoplay timer on every single Tab press.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsPaused(false);
        }
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={active.slug}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <Link
            href={`/shop/${active.slug}`}
            className="absolute inset-0 block"
            aria-label={t("shopAriaLabel", { category: active.name })}
          >
            <SafeImage
              src={active.image}
              alt={active.name}
              fill
              preload={activeIndex === 0}
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
              <span className="label mb-1.5 block text-accent">
                0{activeIndex + 1} / 0{slideCount}
              </span>
              <p className="font-display text-xl font-bold text-white md:text-2xl">
                {active.name}
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-white/90">
                {t("shopNow")}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        </motion.div>
      </AnimatePresence>

      <p className="sr-only" aria-live="polite">
        {t("slideStatus", { category: active.name, current: activeIndex + 1, total: slideCount })}
      </p>

      {slideCount > 1 && (
        <>
          <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 transition-opacity duration-(--duration-base) focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={goPrev}
              aria-label={t("previousSlide")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label={t("nextSlide")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            {categories.map((cat, i) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t("goToSlide", { number: i + 1, category: cat.name })}
                aria-current={i === activeIndex}
                className={`h-1.5 rounded-full transition-all duration-(--duration-base) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  i === activeIndex ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function HeroSection({ categories, banner }: HeroSectionProps) {
  const t = useTranslations("home.hero");

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
                {t("headlineLine1")}
                <br />
                <span className="text-accent">{t("headlineAccent")}</span>
                <br />
                {t("headlineLine3")}
              </h1>
            )}

            <p className="mb-10 max-w-lg text-base leading-relaxed text-muted md:text-lg">
              {banner?.subtitle || brand.description}
            </p>

            <Button asChild size="lg" variant="accent">
              <Link href={banner?.linkUrl || "/shop"}>
                {banner?.ctaText || t("cta")}
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
            <CategorySlider categories={categories} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
