import { Quote, Star } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";
import { SectionHeader } from "@/components/ui/section-header";
import { testimonials } from "@/config/home";

export function ReviewsSection() {
  return (
    <section className="section-padding bg-background pb-12 md:pb-14">
      <div className="container-custom">
        <FadeIn className="section-heading mx-auto max-w-md text-center">
          <SectionHeader
            eyebrow="Client Feedback"
            title="What Our Clients Say"
            description="Trusted by contractors, developers, and businesses across Somalia."
            align="center"
          />
        </FadeIn>

        <div className="grid gap-px bg-border md:grid-cols-3">
          {testimonials.map((review, i) => (
            <FadeIn key={review.name} delay={i * 0.08}>
              <article className="group relative flex h-full flex-col bg-surface p-8 transition-all duration-500 hover:-translate-y-1 hover:shadow-(--shadow-lg) md:p-10">
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
                  &ldquo;{review.text}&rdquo;
                </p>
                <div>
                  <p className="font-display text-sm font-semibold">
                    {review.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {review.role}
                  </p>
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
