"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import type { Category } from "@/lib/types/product";

interface HeroSectionProps {
  categories: Category[];
}

export function HeroSection({ categories }: HeroSectionProps) {
  return (
    <section className="mesh-dark relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
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

            <h1 className="font-display text-balance mb-8 text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-tight text-white">
              Built for
              <br />
              <span className="text-accent">Industry.</span>
              <br />
              Trusted in Trade.
            </h1>

            <p className="mb-10 max-w-lg text-base leading-relaxed text-white/55 md:text-lg">
              {brand.description}
            </p>

            <Button asChild size="lg" variant="accent">
              <Link href="/shop">
                Explore Catalogue
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
                  className={`group relative overflow-hidden bg-dark-surface ${
                    i === 0 ? "col-span-2 aspect-[16/7]" : "aspect-square"
                  }`}
                >
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover opacity-60 transition-all duration-700 group-hover:scale-105 group-hover:opacity-75"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                    <span className="label mb-1 block text-accent/80">
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
          className="mt-16 grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-4"
        >
          {[
            { label: "Industries", value: "3" },
            { label: "Categories", value: "Supply" },
            { label: "Market", value: "Somalia" },
            { label: "Focus", value: "Quality" },
          ].map((stat) => (
            <div key={stat.label} className="bg-dark-surface px-6 py-5">
              <p className="font-display text-2xl font-bold text-white md:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-white/40">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
