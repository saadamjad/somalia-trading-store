"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";

const storyChapters = [
  {
    label: "01 — On the Ground",
    title: "Hands-on leadership at every site",
    description: "Inspecting equipment and materials firsthand.",
    image: "/images/our-story/site-visit-road.jpg",
    alt: "Foley General Trading leadership meeting with partners at an international trade expo",
  },
  {
    label: "02 — Client Partnership",
    title: "Real conversations, real samples",
    description: "Face-to-face with suppliers before every order.",
    image: "/images/our-story/client-consultation.jpg",
    alt: "Foley General Trading leadership at an agricultural trading company booth",
  },
  {
    label: "03 — Quality & Production",
    title: "From factory floor to finished product",
    description: "Direct oversight of manufacturing quality.",
    image: "/images/our-story/manufacturing-quality.jpg",
    alt: "Quality inspection at a heavy machinery manufacturing facility",
  },
];

const galleryMoments = [
  {
    image: "/images/our-story/our-team.jpg",
    alt: "Foley General Trading leadership at an international trade fair",
    caption: "Representing our business",
  },
  {
    image: "/images/our-story/community-event.jpg",
    alt: "Foley General Trading at the UNIDO Somalia trade programme booth",
    caption: "Industry partnerships",
  },
  {
    image: "/images/our-story/paved-project.jpg",
    alt: "Inspecting heavy construction equipment before purchase",
    caption: "Equipment sourcing",
  },
  {
    image: "/images/our-story/hollow-blocks-stock.jpg",
    alt: "Production equipment at an overseas manufacturing facility",
    caption: "Ready to supply",
  },
  {
    image: "/images/our-story/global-manufacturing.jpg",
    alt: "Touring a machinery manufacturing plant",
    caption: "Global partnerships",
  },
  {
    image: "/images/our-story/partnership-office.jpg",
    alt: "Sealing a strategic partnership with an overseas supplier",
    caption: "Trusted partners",
  },
];

export function OurStorySection() {
  return (
    <section className="relative overflow-hidden bg-background">
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

      <div className="container-custom relative z-10 py-16 md:py-20 lg:py-24">
        {/* Intro */}
        <FadeIn className="section-heading mx-auto max-w-2xl text-center">
          <span className="label mb-4 block">Our Story</span>
          <h2 className="font-display text-3xl font-bold text-foreground md:text-5xl">
            Real People.
            <br />
            <span className="text-accent">Real Work.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted md:text-base">
            {brand.shortName} isn&apos;t just a catalogue — it&apos;s a team on
            the ground, in the factory, and at the table with every client we
            serve across Somalia.
          </p>
        </FadeIn>

        {/* Story chapters — image with caption below, not overlaid */}
        <div className="mt-12 grid gap-3 md:mt-16 md:grid-cols-3">
          {storyChapters.map((chapter, i) => (
            <FadeIn key={chapter.label} delay={0.08 + i * 0.06}>
              <article className="h-full border border-border bg-surface">
                <div className="relative aspect-4/3 overflow-hidden bg-muted/10">
                  <Image
                    src={chapter.image}
                    alt={chapter.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
                <div className="p-5 md:p-7">
                  <span className="label mb-1.5 block">{chapter.label}</span>
                  <h3 className="font-display mb-1.5 text-base font-bold text-foreground md:text-lg">
                    {chapter.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-muted md:text-sm">
                    {chapter.description}
                  </p>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>

        {/* Gallery strip — smaller authentic moments */}
        <FadeIn delay={0.2} className="mb-10 mt-12 md:mt-14">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <span className="label mb-2 block">Behind the Business</span>
              <p className="font-display text-lg font-semibold text-foreground md:text-xl">
                Moments that define who we are
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-6">
            {galleryMoments.map((moment, i) => (
              <FadeIn key={moment.caption} delay={0.05 * i}>
                <figure className="group border border-border bg-surface">
                  <div className="relative aspect-square overflow-hidden bg-muted/10">
                    <Image
                      src={moment.image}
                      alt={moment.alt}
                      fill
                      sizes="(max-width: 768px) 50vw, 16vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <figcaption className="px-3 py-2">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {moment.caption}
                    </span>
                  </figcaption>
                </figure>
              </FadeIn>
            ))}
          </div>
        </FadeIn>

        {/* Closing CTA */}
        <FadeIn delay={0.25}>
          <div className="flex flex-col items-center justify-between gap-6 border-t border-border pt-10 sm:flex-row">
            <p className="max-w-md text-sm leading-relaxed text-muted">
              From paver blocks and hollow concrete to doors and fishing
              equipment — every product we supply is backed by people who show
              up, inspect, and stand behind their work.
            </p>
            <Link
              href="/about"
              className="inline-flex shrink-0 items-center gap-2 border border-border-strong px-6 py-3 text-xs font-semibold uppercase tracking-widest text-foreground transition-colors hover:border-accent hover:text-accent-text"
            >
              Learn More About Us
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
