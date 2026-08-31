import { Quote, Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/section-header";
import { testimonials } from "@/config/home";

// testimonials is a static config import, never mutated at runtime — computed once
// here rather than on every render, and guarded against an empty array so this can
// never render "NaN" if that config is ever emptied or made data-driven later.
const averageRating =
  testimonials.length > 0
    ? testimonials.reduce((sum, review) => sum + review.rating, 0) / testimonials.length
    : 0;

const reviewKeys = ["review1", "review2", "review3"] as const;

export async function ReviewsSection() {
  const t = await getTranslations("home.reviews");

  return (
    <section className="section-padding bg-background">
      <div className="container-custom">
        <FadeIn className="section-heading flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader eyebrow={t("eyebrow")} title={t("title")} />
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-accent text-accent"
                  strokeWidth={0}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-foreground">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-sm text-muted">
              {t("reviewsCount", { count: testimonials.length })}
            </span>
          </div>
        </FadeIn>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((review, i) => {
            const key = reviewKeys[i];
            return (
              <FadeIn key={key ?? review.name} delay={i * 0.08}>
                <article className="group relative flex h-full flex-col border border-border bg-surface p-8 shadow-(--shadow-sm) transition-all duration-500 hover:-translate-y-1 hover:shadow-(--shadow-lg) md:p-10">
                  <Quote
                    className="absolute right-6 top-6 h-8 w-8 text-accent-muted transition-colors duration-500 group-hover:text-accent/20"
                    strokeWidth={1.5}
                  />
                  <div className="mb-5 flex gap-1">
                    {Array.from({ length: review.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="h-3.5 w-3.5 fill-accent text-accent"
                        strokeWidth={0}
                      />
                    ))}
                  </div>
                  <p className="mb-8 flex-1 text-sm leading-relaxed text-muted">
                    &ldquo;{key ? t(`items.${key}.text`) : review.text}&rdquo;
                  </p>
                  <div>
                    <p className="font-display text-sm font-semibold">
                      {key ? t(`items.${key}.name`) : review.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {key ? t(`items.${key}.role`) : review.role}
                    </p>
                  </div>
                </article>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
