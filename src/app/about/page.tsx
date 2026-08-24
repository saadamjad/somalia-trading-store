import Image from "next/image";
import Link from "next/link";
import { CategoryCard } from "@/components/product/category-card";
import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";
import { createPageMetadata } from "@/config/seo";
import { productService } from "@/server/services/product-service";

export const metadata = createPageMetadata({
  title: "About Us",
  description: `Learn about ${brand.name} — construction materials, road interlocks, and fishing products across Somalia.`,
  path: "/about",
});

const values = [
  { title: "Quality", description: "Products that meet commercial and project requirements." },
  { title: "Reliability", description: "Dependable supply for ongoing and project-based needs." },
  { title: "Integrity", description: "Honest practices and transparent communication." },
  { title: "Customer Focus", description: "Solutions tailored to your industry and project." },
  { title: "Professionalism", description: "A structured, business-ready approach to supply." },
  { title: "Partnerships", description: "Long-term relationships with the communities we serve." },
];

export default async function AboutPage() {
  const categories = await productService.getCategories();

  return (
    <>
      <section className="mesh-light relative overflow-hidden pt-(--header-height)">
        <div className="container-custom py-24 md:py-32">
          <FadeIn>
            <span className="label mb-6 block">About</span>
            <h1 className="font-display mb-6 max-w-3xl text-4xl font-bold text-foreground md:text-6xl">
              Your Trusted Trading Partner in Somalia
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
            <span className="label mb-4 block">Our Story</span>
            <h2 className="font-display mb-6 text-3xl font-bold">Who We Are</h2>
            <div className="space-y-4 leading-relaxed text-muted">
              <p>
                {brand.name} serves businesses, contractors, and communities
                across Somalia with products spanning construction materials,
                road interlocks — with a focus on paver blocks and installation
                materials — and fishing products.
              </p>
              <p>
                Our focus is reliable access to quality products, from building
                materials and doors to interlocking paver blocks and professional
                fishing equipment. We are on the ground at project sites, in
                consultations with clients, and at the factory ensuring every
                product meets our standards.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src="/images/our-story/leadership-site.jpg"
                alt="Foley General Trading leadership representing the business internationally"
                fill
                className="object-cover"
              />
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="section-padding border-y border-border bg-accent-muted/30">
        <div className="container-custom grid gap-8 md:grid-cols-2">
          <FadeIn>
            <h3 className="font-display mb-4 text-2xl font-bold">Mission</h3>
            <p className="leading-relaxed text-muted">
              To provide reliable access to quality products and dependable
              supply solutions that support businesses, projects, and communities
              across Somalia.
            </p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h3 className="font-display mb-4 text-2xl font-bold">Vision</h3>
            <p className="leading-relaxed text-muted">
              To become a trusted trading and supply partner across construction,
              infrastructure, and fishing industries.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom">
          <FadeIn className="mb-12 text-center">
            <span className="label mb-4 block">Values</span>
            <h2 className="font-display text-3xl font-bold">Core Values</h2>
          </FadeIn>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, i) => (
              <FadeIn key={value.title} delay={i * 0.05}>
                <div className="bg-background p-8">
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
            <span className="label mb-4 block">Industries</span>
            <h2 className="font-display text-3xl font-bold">Business Areas</h2>
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
              Get in Touch
            </h2>
            <p className="mx-auto mb-8 max-w-md text-muted">
              Have a project or product inquiry? Contact us or browse our
              catalogue.
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
              Browse Products
            </Link>
          </FadeIn>
        </div>
      </section>
    </>
  );
}
