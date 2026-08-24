import Image from "next/image";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";
import { createPageMetadata } from "@/config/seo";
import { galleryMoments } from "@/config/gallery";

export const metadata = createPageMetadata({
  title: "Gallery",
  description: `Real moments from ${brand.name} — trade expos, factory visits, and partnerships across our business.`,
  path: "/gallery",
});

export default function GalleryPage() {
  return (
    <>
      <section className="mesh-light relative overflow-hidden pt-(--header-height)">
        <div className="container-custom py-20 md:py-28">
          <FadeIn>
            <span className="label mb-4 block">Behind the Business</span>
            <h1 className="font-display mb-5 max-w-2xl text-4xl font-bold text-foreground md:text-6xl">
              Our Gallery
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted md:text-base">
              Real moments from the field — trade expos, factory visits, and
              the partnerships behind every product we supply.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="section-padding section-after-hero">
        <div className="container-custom">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {galleryMoments.map((moment, i) => (
              <FadeIn key={moment.caption} delay={i * 0.05}>
                <figure className="border border-border bg-surface">
                  <div className="relative aspect-4/3 overflow-hidden bg-muted/10">
                    <Image
                      src={moment.image}
                      alt={moment.alt}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                  <figcaption className="px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      {moment.caption}
                    </span>
                  </figcaption>
                </figure>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
