import { Award, ShieldCheck, Truck, HeadphonesIcon } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";

const pillars = [
  {
    icon: ShieldCheck,
    title: "Quality Assured",
    description:
      "Products selected to meet commercial and project-grade requirements across every division.",
  },
  {
    icon: Truck,
    title: "Reliable Supply",
    description:
      "Consistent stock and dependable delivery for ongoing projects and bulk orders.",
  },
  {
    icon: Award,
    title: "Industry Expertise",
    description:
      "Specialist knowledge in construction materials, road interlocks, and fishing products.",
  },
  {
    icon: HeadphonesIcon,
    title: "Dedicated Support",
    description:
      "Responsive communication and professional guidance from inquiry to fulfilment.",
  },
];

export function WhyChooseSection() {
  return (
    <section className="section-padding bg-accent-muted/20">
      <div className="container-custom">
        <FadeIn className="section-heading max-w-xl">
          <span className="label mb-4 block">Why FGT</span>
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            A Partner You Can
            <br />
            Count On
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            From paver blocks and doors to fishing equipment — we combine
            product quality with the service standards your business expects.
          </p>
        </FadeIn>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, i) => (
            <FadeIn key={pillar.title} delay={i * 0.06}>
              <div className="group h-full border border-border bg-background p-8 transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-(--shadow-md)">
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-accent-muted transition-colors duration-500 group-hover:bg-accent/20">
                  <pillar.icon
                    className="h-5 w-5 text-accent-text"
                    strokeWidth={1.5}
                  />
                </span>
                <h3 className="font-display mb-3 font-semibold">
                  {pillar.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">
                  {pillar.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
