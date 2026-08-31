import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/motion";
import { whyChoosePillars } from "@/config/home";

export async function WhyChooseSection() {
  const t = await getTranslations("home.whyChoose");
  const pillarKeys = ["quality", "supply", "expertise", "support"] as const;

  return (
    <section className="section-padding section-after-band mesh-dark relative overflow-hidden">
      <div className="container-custom relative z-10">
        <FadeIn className="section-heading max-w-xl">
          <span className="label text-accent mb-4 block">{t("eyebrow")}</span>
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
            {t("titleLine1")}
            <br />
            {t("titleLine2")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            {t("description")}
          </p>
        </FadeIn>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {whyChoosePillars.map((pillar, i) => {
            const key = pillarKeys[i];
            return (
              <FadeIn key={key ?? i} delay={i * 0.06}>
                <div className="group h-full border border-white/10 bg-white/5 p-8 backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:bg-white/[0.07]">
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 transition-colors duration-500 group-hover:bg-accent/25">
                    <pillar.icon
                      className="h-5 w-5 text-accent"
                      strokeWidth={1.5}
                    />
                  </span>
                  <h3 className="font-display mb-3 font-semibold text-white">
                    {key ? t(`pillars.${key}.title`) : pillar.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/60">
                    {key ? t(`pillars.${key}.description`) : pillar.description}
                  </p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
