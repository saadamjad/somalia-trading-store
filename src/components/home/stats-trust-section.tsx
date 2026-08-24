import { FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/section-header";
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
        <FadeIn className="section-heading mx-auto max-w-lg text-center">
          <SectionHeader
            eyebrow="Trusted Across Somalia"
            title="Built on Reliability"
            description={`${brand.shortName} supports contractors, developers, and businesses with dependable supply across construction, infrastructure, and marine sectors.`}
            align="center"
          />
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
