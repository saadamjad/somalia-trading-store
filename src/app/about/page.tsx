import Image from "next/image";
import Link from "next/link";
import { CategoryCard } from "@/components/product/category-card";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";
import { createPageMetadata } from "@/config/seo";
import { productService } from "@/server/services/product-service";
import {
  aboutHero,
  ourStory,
  missionVision,
  companyValues,
  businessAreas,
  getInTouch,
} from "@/config/about";

export const metadata = createPageMetadata({
  title: "About Us",
  description: `Learn about ${brand.name} — construction materials, road interlocks, and fishing products across Somalia.`,
  path: "/about",
});

export default async function AboutPage() {
  const categories = await productService.getCategories();

  return (
    <>
      <section className="mesh-light relative overflow-hidden pt-(--header-height)">
        <div className="container-custom py-24 md:py-32">
          <FadeIn>
            <span className="label mb-6 block">{aboutHero.eyebrow}</span>
            <h1 className="font-display mb-6 max-w-3xl text-4xl font-bold text-foreground md:text-6xl">
              {aboutHero.title}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted">
              {brand.description}
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom grid items-center gap-16 lg:grid-cols-2">
          <FadeIn>
            <span className="label mb-4 block">{ourStory.eyebrow}</span>
            <h2 className="font-display mb-6 text-3xl font-bold">{ourStory.title}</h2>
            <div className="space-y-4 leading-relaxed text-muted">
              <p>{ourStory.paragraph1.replace("%s", brand.name)}</p>
              <p>{ourStory.paragraph2}</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={ourStory.image.src}
                alt={ourStory.image.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="section-padding border-y border-border bg-accent-muted/30">
        <div className="container-custom grid gap-8 md:grid-cols-2">
          <FadeIn>
            <h3 className="font-display mb-4 text-2xl font-bold">{missionVision.mission.title}</h3>
            <p className="leading-relaxed text-muted">{missionVision.mission.description}</p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h3 className="font-display mb-4 text-2xl font-bold">{missionVision.vision.title}</h3>
            <p className="leading-relaxed text-muted">{missionVision.vision.description}</p>
          </FadeIn>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom">
          <FadeIn className="mb-12 text-center">
            <span className="label mb-4 block">Values</span>
            <h2 className="font-display text-3xl font-bold">Core Values</h2>
          </FadeIn>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companyValues.map((value, i) => (
              <FadeIn key={value.title} delay={i * 0.05}>
                <div className="h-full border border-border bg-background p-8 transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-(--shadow-md)">
                  <h3 className="font-display mb-2 font-semibold">{value.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {value.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding border-t border-border">
        <div className="container-custom">
          <FadeIn className="mb-12 text-center">
            <span className="label mb-4 block">{businessAreas.eyebrow}</span>
            <h2 className="font-display text-3xl font-bold">{businessAreas.title}</h2>
          </FadeIn>
          <div className="grid gap-px bg-border md:grid-cols-3">
            {categories.map((category, i) => (
              <FadeIn key={category.slug} delay={i * 0.1}>
                <CategoryCard category={category} index={i} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="mesh-light section-padding border-t border-border">
        <div className="container-custom text-center">
          <FadeIn>
            <h2 className="font-display mb-4 text-3xl font-bold text-foreground md:text-4xl">
              {getInTouch.title}
            </h2>
            <p className="mx-auto mb-8 max-w-md text-muted">
              {getInTouch.description}
            </p>
            <div className="mb-8 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              {brand.contact.phones.map((phone) => (
                <a
                  key={phone}
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="transition-colors hover:text-accent-text"
                >
                  {phone}
                </a>
              ))}
            </div>
            <Link
              href="/shop"
              className="inline-flex h-14 items-center justify-center bg-accent px-9 text-sm font-semibold text-foreground transition-colors hover:bg-accent-hover"
            >
              {getInTouch.ctaText}
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
