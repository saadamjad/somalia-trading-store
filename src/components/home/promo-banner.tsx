import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import type { BannerView } from "@/server/services/banner-service";

interface PromoBannerProps {
  banner: BannerView;
}

/**
 * Admin-managed promotional strip for the `HOMEPAGE_PROMO` slot. Rendered by
 * src/app/page.tsx only when an active, in-schedule banner exists for that slot — when
 * none does, the homepage simply omits this section entirely (see page.tsx), which is
 * inherently safe (no blank/broken section) rather than needing its own fallback copy.
 */
export function PromoBanner({ banner }: PromoBannerProps) {
  return (
    <section className="section-band border-y border-border bg-accent-muted/30">
      <div className="container-custom grid items-center gap-8 md:grid-cols-[auto_1fr_auto]">
        {banner.imageUrl && (
          <FadeIn className="relative aspect-[16/9] w-full overflow-hidden md:w-64">
            <Image
              src={banner.imageUrl}
              alt={banner.title}
              fill
              sizes="(max-width: 768px) 100vw, 256px"
              className="object-cover"
            />
          </FadeIn>
        )}
        <FadeIn delay={0.1}>
          <h2 className="font-display text-2xl font-bold md:text-3xl">{banner.title}</h2>
          {banner.subtitle && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted md:text-base">
              {banner.subtitle}
            </p>
          )}
        </FadeIn>
        {banner.linkUrl && banner.ctaText && (
          <FadeIn delay={0.15}>
            <Link
              href={banner.linkUrl}
              className="group inline-flex h-12 items-center justify-center gap-2 bg-accent px-6 text-sm font-semibold text-foreground shadow-(--shadow-sm) transition-all duration-(--duration-base) hover:bg-accent-hover hover:shadow-(--shadow-md)"
            >
              {banner.ctaText}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
            </Link>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
