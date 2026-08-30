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
    title: "Refund & Return Policy",
    description: "How refunds, returns, and exchanges work for orders placed with us.",
    path: "/refund-policy",
    locale,
  });
}

// Fallback content shown when no "refund-policy" CMSPage has been published yet —
// mirrors the FAQ page's pattern (src/app/faq/page.tsx) so a fresh deploy never shows a
// blank page. An admin publishing a "refund-policy" CMSPage from /admin/cms overrides
// this entirely. Return and refund are treated as one combined policy/flow, matching the
// existing RefundRequest workflow (Phase 10) which does not distinguish the two. This is
// a draft starting point for an admin to review and edit, not binding legal copy.
const FALLBACK_BLOCKS: CMSBlock[] = [
  {
    type: "paragraph",
    text: "We want you to be satisfied with every order. This policy explains how returns and refunds work for products purchased through our website, across our construction materials, road interlocks, and fishing products ranges.",
  },
  {
    type: "heading",
    text: "How to Request a Refund or Return",
  },
  {
    type: "paragraph",
    text: "Sign in to your account, open the relevant order, and submit a refund/return request with a reason. Our team reviews every request individually and will follow up with next steps, which may include returning the item before a refund is issued.",
  },
  {
    type: "heading",
    text: "Eligibility",
  },
  {
    type: "paragraph",
    text: "Requests are generally accepted for items that are defective, damaged in transit, or materially different from what was ordered. Items should be unused and in their original condition where a physical return is required, unless the item itself is the reason for the claim (e.g. it arrived damaged).",
  },
  {
    type: "heading",
    text: "Bulk & Project Orders",
  },
  {
    type: "paragraph",
    text: "Large-volume or project-scale orders placed through a quote request are handled case by case with our sales team, since these often involve custom quantities, delivery schedules, or site-specific materials.",
  },
  {
    type: "heading",
    text: "Refund Method & Timing",
  },
  {
    type: "paragraph",
    text: "Approved refunds are issued back to the original payment method (or as otherwise agreed) once the request is reviewed and, where applicable, the returned item is received and inspected. Processing times can vary depending on your payment provider.",
  },
  {
    type: "heading",
    text: "Non-Returnable Situations",
  },
  {
    type: "paragraph",
    text: "Custom-cut, custom-ordered, or clearly used/installed materials may not be eligible for return unless there is a genuine defect or delivery error. If you are unsure whether your item qualifies, submit a request or contact us and we will advise you.",
  },
  {
    type: "heading",
    text: "Questions",
  },
  {
    type: "paragraph",
    text: "If you need help with an existing order or aren't sure how to proceed, reach out through our Contact page and our team will guide you through the process. This page is a general draft intended for ongoing review.",
  },
];

export default async function RefundPolicyPage() {
  const page = await cmsPageService.getPublishedBySlug("refund-policy");
  const blocks = page ? (page.body as CMSBlock[]) : FALLBACK_BLOCKS;
  const title = page?.title ?? "Refund & Return Policy";

  return (
    <section className="section-padding pt-32">
      <div className="container-custom max-w-3xl">
        <FadeIn className="mb-12">
          <span className="label mb-4 block text-accent">Legal</span>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
        </FadeIn>
        <FadeIn delay={0.1}>
          <PageRenderer blocks={blocks} />
        </FadeIn>
      </div>
    </section>
  );
}
