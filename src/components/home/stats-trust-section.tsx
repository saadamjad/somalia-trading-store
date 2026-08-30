import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/section-header";
import { brand } from "@/config/brand";
import { trustStats } from "@/config/home";

export async function StatsTrustSection() {
  const t = await getTranslations("home.statsTrust");

  return (
    <section className="section-band border-y border-border bg-surface">
      <div className="container-custom">
        <FadeIn className="section-heading mx-auto max-w-lg text-center">
          <SectionHeader
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description", { shortName: brand.shortName })}
            align="center"
          />
        </FadeIn>

        <div className="grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4">
          {trustStats.map((stat, i) => (
            <FadeIn key={stat.label} delay={i * 0.06}>
              <div className="group bg-background px-6 py-8 text-center transition-colors duration-500 hover:bg-accent-muted/30 md:px-8 md:py-10">
                <p className="font-display text-3xl font-bold text-foreground transition-colors duration-500 group-hover:text-accent-text md:text-4xl">
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
