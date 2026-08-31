"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";
import { galleryMoments } from "@/config/gallery";

const storyChapterImages = [
  { key: "chapter1", image: "/images/our-story/site-visit-road.jpg" },
  { key: "chapter2", image: "/images/our-story/client-consultation.jpg" },
  { key: "chapter3", image: "/images/our-story/manufacturing-quality.jpg" },
] as const;

export function OurStorySection() {
  const t = useTranslations("home.ourStory");
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const tileWidth = el.querySelector("[data-gallery-tile]")?.clientWidth ?? 240;
    el.scrollBy({ left: direction === "left" ? -tileWidth - 12 : tileWidth + 12, behavior: "smooth" });
  };

  return (
    <section className="section-padding section-after-hero relative overflow-hidden bg-background">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 80% 20%, rgba(200, 162, 74, 0.08) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 10% 80%, rgba(200, 162, 74, 0.04) 0%, transparent 50%)
          `,
        }}
      />

      <div className="container-custom relative z-10">
        {/* Intro */}
        <FadeIn className="section-heading mx-auto max-w-2xl text-center">
          <span className="label mb-4 block">{t("eyebrow")}</span>
          <h2 className="font-display text-3xl font-bold text-foreground md:text-5xl">
            {t("titleLine1")}
            <br />
            <span className="text-accent">{t("titleAccent")}</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted md:text-base">
            {t("description", { shortName: brand.shortName })}
          </p>
        </FadeIn>

        {/* Story chapters — image with caption below, not overlaid */}
        <div className="mt-12 grid gap-3 md:mt-16 md:grid-cols-3">
          {storyChapterImages.map((chapter, i) => (
            <FadeIn key={chapter.key} delay={0.08 + i * 0.06}>
              <article className="h-full border border-border bg-surface transition-shadow duration-(--duration-base) hover:shadow-(--shadow-md)">
                <div className="relative aspect-4/3 overflow-hidden bg-muted/10">
                  <Image
                    src={chapter.image}
                    alt={t(`chapters.${chapter.key}.alt`)}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
                <div className="p-5 md:p-7">
                  <span className="label mb-1.5 block">{t(`chapters.${chapter.key}.label`)}</span>
                  <h3 className="font-display mb-1.5 text-base font-bold text-foreground md:text-lg">
                    {t(`chapters.${chapter.key}.title`)}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted md:text-sm">
                    {t(`chapters.${chapter.key}.description`)}
                  </p>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>

        {/* Gallery strip — horizontal scroller of authentic moments */}
        <FadeIn delay={0.2} className="mb-10 mt-12 md:mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="label mb-2 block">{t("gallery.eyebrow")}</span>
              <p className="font-display text-lg font-semibold text-foreground md:text-xl">
                {t("gallery.title")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/gallery"
                className="group hidden items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:text-accent-text sm:inline-flex"
              >
                {t("gallery.viewAll")}
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
              </Link>
              <div className="hidden items-center gap-2 md:flex">
                <button
                  type="button"
                  onClick={() => scrollByAmount("left")}
                  aria-label={t("gallery.scrollLeft")}
                  className="flex h-9 w-9 items-center justify-center border border-border-strong text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollByAmount("right")}
                  aria-label={t("gallery.scrollRight")}
                  className="flex h-9 w-9 items-center justify-center border border-border-strong text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2"
          >
            {galleryMoments.map((moment) => (
              <figure
                key={moment.caption}
                data-gallery-tile
                className="w-[65vw] shrink-0 snap-start border border-border bg-surface sm:w-56 md:w-60"
              >
                <div className="relative aspect-square overflow-hidden bg-muted/10">
                  <Image
                    src={moment.image}
                    alt={moment.alt}
                    fill
                    sizes="(max-width: 768px) 65vw, 240px"
                    className="object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
                <figcaption className="px-3 py-2">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {moment.caption}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          <Link
            href="/gallery"
            className="group mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:text-accent-text sm:hidden"
          >
            {t("gallery.viewAll")}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
