import { FadeIn } from "@/components/ui/motion";
import { brand } from "@/config/brand";

const stats = [
  { value: "500+", label: "Clients Served" },
  { value: "3", label: "Industry Divisions" },
  { value: "10+", label: "Years Experience" },
  { value: "100%", label: "Quality Focus" },
];

export function StatsTrustSection() {
  return (
    <section className="section-band border-y border-border bg-surface">
      <div className="container-custom">
        <FadeIn className="section-heading text-center">
          <span className="label mb-4 block">Trusted Across Somalia</span>
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Built on Reliability
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">
            {brand.shortName} supports contractors, developers, and businesses
            with dependable supply across construction, infrastructure, and
            marine sectors.
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
          {stats.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.06}>
              <div className="bg-background px-6 py-8 text-center md:px-8 md:py-10">
                <p className="font-display text-3xl font-bold text-foreground md:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted">
                  {stat.label}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
