import { FadeIn } from "@/components/ui/motion";
import { PageRenderer } from "@/components/cms/page-renderer";
import { createPageMetadata } from "@/config/seo";
import { isLocale, defaultLocale } from "@/config/i18n";
import { cmsPageService } from "@/server/services/cms-page-service";
import type { CMSBlock } from "@/lib/validations/cms";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return createPageMetadata({
    title: "FAQ",
    description: "Answers to common questions about ordering, delivery, and our product range.",
    path: "/faq",
    locale,
  });
}

// Fallback content shown when no "faq" CMSPage has been published yet — new/fresh
// deploys must never show a blank/broken FAQ page (Phase 12 requirement). An admin
// publishing a "faq" CMSPage from /admin/cms overrides this entirely.
const FALLBACK_BLOCKS: CMSBlock[] = [
  {
    type: "faqItem",
    question: "How do I place an order?",
    answer:
      "Browse our catalogue, add products to your cart, and complete checkout with your contact and delivery details. For bulk or project-scale orders, use the Quote Request form instead.",
  },
  {
    type: "faqItem",
    question: "Do you offer bulk or project pricing?",
    answer:
      "Yes — submit a quote request with the products and quantities you need and our team will respond with pricing.",
  },
  {
    type: "faqItem",
    question: "What areas do you deliver to?",
    answer:
      "Contact our team directly with your location for current delivery coverage and timelines.",
  },
  {
    type: "faqItem",
    question: "Can I return or exchange a product?",
    answer:
      "Yes — sign in, open the relevant order under your account, and submit a refund/return request with a reason. Our team reviews every request.",
  },
];

export default async function FAQPage() {
  const page = await cmsPageService.getPublishedBySlug("faq");
  const blocks = page ? (page.body as CMSBlock[]) : FALLBACK_BLOCKS;
  const title = page?.title ?? "Frequently Asked Questions";

  return (
    <section className="section-padding pt-32">
      <div className="container-custom max-w-3xl">
        <FadeIn className="mb-12">
          <span className="label mb-4 block text-accent">Support</span>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <PageRenderer blocks={blocks} />
        </FadeIn>
      </div>
    </section>
  );
}
