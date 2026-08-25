import { FadeIn } from "@/components/ui/motion";
import { whyChoosePillars, whyChooseHeading } from "@/config/home";

export function WhyChooseSection() {
  return (
    <section className="section-padding bg-accent-muted/20">
      <div className="container-custom">
        <FadeIn className="section-heading max-w-xl">
          <span className="label mb-4 block">{whyChooseHeading.eyebrow}</span>
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            {whyChooseHeading.titleLine1}
            <br />
            {whyChooseHeading.titleLine2}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {whyChooseHeading.description}
          </p>
        </FadeIn>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {whyChoosePillars.map((pillar, i) => (
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
