import Link from "next/link";
import { ArrowUpRight, Phone } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";
import { trustStripItems } from "@/config/home";

export function TrustStrip() {
  const items = trustStripItems;

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

export function CTABanner() {
  return (
    <section className="section-padding mesh-light relative overflow-hidden">
      <div className="container-custom relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <FadeIn className="lg:col-span-7">
            <span className="label mb-6 block">Start Here</span>
            <h2 className="font-display mb-6 text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.05] text-foreground">
              Ready to source
              <br />
              <span className="text-accent">quality products?</span>
            </h2>
            <p className="mb-8 max-w-lg text-sm leading-relaxed text-muted md:text-base">
              Browse our catalogue across construction materials, road interlocks,
              and fishing products — select a category to explore the full range.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="group inline-flex h-14 items-center justify-center gap-3 bg-accent px-8 text-sm font-semibold text-foreground shadow-(--shadow-sm) transition-all duration-(--duration-base) hover:bg-accent-hover hover:shadow-(--shadow-md)"
              >
                Explore Catalogue
                <ArrowUpRight className="h-4 w-4 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/about"
                className="inline-flex h-14 items-center justify-center border border-border-strong px-8 text-sm font-semibold text-foreground transition-colors hover:border-foreground hover:bg-foreground/5"
              >
                Contact Us
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} className="lg:col-span-5">
            <div className="border border-border bg-surface p-8 md:p-10">
              <p className="label mb-6">Direct Line</p>
              <div className="space-y-4">
                {brand.contact.phones.map((phone) => (
                  <a
                    key={phone}
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-4 text-foreground transition-colors hover:text-accent-text"
                  >
                    <span className="flex h-10 w-10 items-center justify-center border border-border">
                      <Phone className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                    <span className="font-display text-lg font-semibold tracking-tight">
                      {phone}
                    </span>
                  </a>
                ))}
              </div>
              <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
                Speak with our team for product availability, project supply,
                and bulk orders across all categories.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
