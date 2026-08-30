import Link from "next/link";
import { ArrowUpRight, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";

const trustStripItemKeys = ["item1", "item2", "item3", "item4", "item5", "item6"] as const;

export async function TrustStrip() {
  const t = await getTranslations("home.trustStrip");
  const items = trustStripItemKeys.map((key) => t(`items.${key}`));

  return (
    <section className="overflow-hidden border-y border-border bg-accent-muted/30 py-5">
      <div className="flex animate-marquee gap-12 whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span className="h-1 w-1 rounded-full bg-accent" />
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

export async function CTABanner() {
  const t = await getTranslations("home.ctaBanner");

  return (
    <section className="section-padding mesh-dark relative overflow-hidden">
      <div className="container-custom relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <FadeIn className="lg:col-span-7">
            <span className="label text-accent mb-6 block">{t("eyebrow")}</span>
            <h2 className="font-display mb-6 text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.05] text-white">
              {t("titleLine1")}
              <br />
              <span className="text-accent">{t("titleAccent")}</span>
            </h2>
            <p className="mb-8 max-w-lg text-sm leading-relaxed text-white/60 md:text-base">
              {t("description")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="group inline-flex h-14 items-center justify-center gap-3 bg-accent px-8 text-sm font-semibold text-foreground shadow-(--shadow-sm) transition-all duration-(--duration-base) hover:bg-accent-hover hover:shadow-(--shadow-md)"
              >
                {t("exploreCatalogue")}
                <ArrowUpRight className="h-4 w-4 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/about"
                className="inline-flex h-14 items-center justify-center border border-white/20 px-8 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
              >
                {t("contactUs")}
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} className="lg:col-span-5">
            <div className="border border-white/10 bg-white/5 p-8 backdrop-blur-sm md:p-10">
              <p className="label text-accent mb-6">{t("directLine")}</p>
              <div className="space-y-4">
                {brand.contact.phones.map((phone) => (
                  <a
                    key={phone}
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-4 text-white transition-colors hover:text-accent"
                  >
                    <span className="flex h-10 w-10 items-center justify-center border border-white/20">
                      <Phone className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                    <span className="font-display text-lg font-semibold tracking-tight">
                      {phone}
                    </span>
                  </a>
                ))}
              </div>
              <p className="mt-8 text-xs leading-relaxed text-white/50">
                {t("footnote")}
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
