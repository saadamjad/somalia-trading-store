"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";

const storyChapters = [
  {
    label: "01 — On the Ground",
    title: "Hands-on leadership at every project site",
    description:
      "Our team walks the sites we supply — inspecting paved surfaces, reviewing installations, and ensuring every delivery meets the standard our clients expect.",
    image: "/images/our-story/site-visit-road.png",
    alt: "FGT leadership inspecting a paved road project",
    span: "large" as const,
  },
  {
    label: "02 — Client Partnership",
    title: "Personal consultations, real product samples",
    description:
      "We sit with contractors and developers face-to-face — reviewing paver designs, block specifications, and project requirements before any order is placed.",
    image: "/images/our-story/client-consultation.png",
    alt: "Client consultation with paver block samples",
    span: "medium" as const,
  },
  {
    label: "03 — Quality & Production",
    title: "From factory floor to finished product",
    description:
      "We work directly with manufacturers, inspecting molds and production standards to guarantee consistent quality across our full paver and block range.",
    image: "/images/our-story/manufacturing-quality.png",
    alt: "Quality inspection at paver manufacturing facility",
    span: "medium" as const,
  },
];

const galleryMoments = [
  {
    image: "/images/our-story/our-team.png",
    alt: "FGT operations team in uniform",
    caption: "Our dedicated team",
  },
  {
    image: "/images/our-story/community-event.png",
    alt: "FGT community product launch event",
    caption: "Community engagement",
  },
  {
    image: "/images/our-story/paved-project.png",
    alt: "Completed paved road project",
    caption: "Projects delivered",
  },
  {
    image: "/images/our-story/hollow-blocks-stock.png",
    alt: "Hollow concrete blocks in stock",
    caption: "Ready to supply",
  },
  {
    image: "/images/our-story/global-manufacturing.png",
    alt: "International manufacturing partnership",
    caption: "Global partnerships",
  },
  {
    image: "/images/our-story/partnership-office.png",
    alt: "International business partnership meeting",
    caption: "Trusted partners",
  },
];

export function OurStorySection() {
  return (
    <section className="relative overflow-hidden bg-[#0c0c0c]">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 80% 20%, rgba(200, 162, 74, 0.08) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 10% 80%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="container-custom relative z-10 py-16 md:py-20 lg:py-24">
        {/* Intro */}
        <FadeIn className="section-heading mx-auto max-w-2xl text-center">
          <span className="label mb-4 block text-accent">Our Story</span>
          <h2 className="font-display text-3xl font-bold text-white md:text-5xl">
            Real People.
            <br />
            <span className="text-accent">Real Work.</span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-white/50 md:text-base">
            {brand.shortName} isn&apos;t just a catalogue — it&apos;s a team on
            the ground, in the factory, and at the table with every client we
            serve across Somalia.
          </p>
        </FadeIn>

        {/* Featured story chapter — full width hero moment */}
        <FadeIn delay={0.08} className="mb-3 mt-12 md:mt-16">
          <div className="group relative aspect-[16/9] overflow-hidden bg-[#141414] md:aspect-[21/9]">
            <Image
              src={storyChapters[0].image}
              alt={storyChapters[0].alt}
              fill
              sizes="100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 lg:p-12">
              <span className="label mb-3 block text-accent/80">
                {storyChapters[0].label}
              </span>
              <h3 className="font-display mb-3 max-w-xl text-xl font-bold text-white md:text-2xl lg:text-3xl">
                {storyChapters[0].title}
              </h3>
              <p className="max-w-lg text-sm leading-relaxed text-white/55">
                {storyChapters[0].description}
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Two-column chapters */}
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          {storyChapters.slice(1).map((chapter, i) => (
            <FadeIn key={chapter.label} delay={0.12 + i * 0.06}>
              <article className="group relative aspect-[4/3] overflow-hidden bg-[#141414]">
                <Image
                  src={chapter.image}
                  alt={chapter.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                  <span className="label mb-2 block text-accent/70">
                    {chapter.label}
                  </span>
                  <h3 className="font-display mb-2 text-base font-bold text-white md:text-lg">
                    {chapter.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-white/50 md:text-sm">
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
              <span className="label mb-2 block text-accent/70">
                Behind the Business
              </span>
              <p className="font-display text-lg font-semibold text-white md:text-xl">
                Moments that define who we are
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-6">
            {galleryMoments.map((moment, i) => (
              <FadeIn key={moment.caption} delay={0.05 * i}>
                <figure className="group relative aspect-square overflow-hidden bg-[#141414]">
                  <Image
                    src={moment.image}
                    alt={moment.alt}
                    fill
                    sizes="(max-width: 768px) 50vw, 16vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-3">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-white/70">
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
          <div className="flex flex-col items-center justify-between gap-6 border-t border-white/10 pt-10 sm:flex-row">
            <p className="max-w-md text-sm leading-relaxed text-white/45">
              From paver blocks and hollow concrete to doors and fishing
              equipment — every product we supply is backed by people who show
              up, inspect, and stand behind their work.
            </p>
            <Link
              href="/about"
              className="inline-flex shrink-0 items-center gap-2 border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:border-accent hover:text-accent"
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
