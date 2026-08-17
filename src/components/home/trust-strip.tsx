import Link from "next/link";
import { ArrowUpRight, Phone } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";

export function TrustStrip() {
  const items = [
    "Reliable Supply",
    "Quality Products",
    "Multi-Industry",
    "Customer Focus",
    "Professional Service",
    "Somalia Market",
  ];

  return (
    <section className="overflow-hidden border-y border-border bg-foreground py-5">
      <div className="flex animate-marquee gap-12 whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-background/60"
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
    <section className="relative overflow-hidden bg-[#0c0c0c]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 50% at 20% 50%, rgba(200, 162, 74, 0.12) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 80% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 50%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="container-custom relative z-10 py-16 md:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <FadeIn className="lg:col-span-7">
            <span className="label mb-6 block text-accent">Start Here</span>
            <h2 className="font-display mb-6 text-[clamp(2rem,4vw,3.5rem)] font-bold leading-[1.05] text-white">
              Ready to source
              <br />
              <span className="text-accent">quality products?</span>
            </h2>
            <p className="mb-8 max-w-lg text-sm leading-relaxed text-white/55 md:text-base">
              Browse our catalogue across construction materials, road interlocks,
              and fishing products — select a category to explore the full range.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex h-14 items-center justify-center gap-3 bg-accent px-8 text-sm font-semibold text-foreground transition-colors hover:bg-accent-hover"
              >
                Explore Catalogue
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex h-14 items-center justify-center border border-white/15 px-8 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5"
              >
                Contact Us
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.1} className="lg:col-span-5">
            <div className="border border-white/10 bg-white/[0.03] p-8 md:p-10">
              <p className="label mb-6 text-accent/80">Direct Line</p>
              <div className="space-y-4">
                {brand.contact.phones.map((phone) => (
                  <a
                    key={phone}
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-4 text-white transition-colors hover:text-accent"
                  >
                    <span className="flex h-10 w-10 items-center justify-center border border-white/10">
                      <Phone className="h-4 w-4" strokeWidth={1.5} />
                    </span>
                    <span className="font-display text-lg font-semibold tracking-tight">
                      {phone}
                    </span>
                  </a>
                ))}
              </div>
              <p className="mt-8 text-xs leading-relaxed text-white/40">
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
