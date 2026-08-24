import { FadeIn } from "@/components/ui/motion";
import { PageRenderer } from "@/components/cms/page-renderer";
import { createPageMetadata } from "@/config/seo";
import { cmsPageService } from "@/server/services/cms-page-service";
import type { CMSBlock } from "@/lib/validations/cms";
import { brand } from "@/config/brand";

export const metadata = createPageMetadata({
  title: "Privacy Policy",
  description: "How we collect, use, and protect your personal information.",
  path: "/privacy",
});

// Fallback content shown when no "privacy" CMSPage has been published yet — mirrors the
// FAQ page's pattern (src/app/faq/page.tsx) so a fresh deploy never shows a blank page.
// An admin publishing a "privacy" CMSPage from /admin/cms overrides this entirely. This
// is a draft starting point for an admin to review and edit, not binding legal copy.
const FALLBACK_BLOCKS: CMSBlock[] = [
  {
    type: "paragraph",
    text: `${brand.name} respects your privacy. This policy explains what personal information we collect when you use our website, place an order, or request a quote, and how we use and protect it.`,
  },
  {
    type: "heading",
    text: "Information We Collect",
  },
  {
    type: "paragraph",
    text: "We collect information you provide directly, such as your name, email address, phone number, delivery address, and order or quote details. We also collect basic technical information (such as pages visited and device/browser type) to help us keep the site working correctly.",
  },
  {
    type: "heading",
    text: "How We Use Your Information",
  },
  {
    type: "paragraph",
    text: "We use your information to process orders and quote requests, deliver products, respond to support and refund/return requests, manage your account, and communicate with you about your orders. We do not sell your personal information to third parties.",
  },
  {
    type: "heading",
    text: "Sharing of Information",
  },
  {
    type: "paragraph",
    text: "We share information only where necessary to fulfil your order — for example with delivery partners — or where required by law. Staff access to customer information is limited to what is needed to serve your order or account request.",
  },
  {
    type: "heading",
    text: "Data Retention & Security",
  },
  {
    type: "paragraph",
    text: "We keep account and order information for as long as your account is active or as needed to meet our legal and accounting obligations, and we take reasonable technical and organisational measures to protect it against unauthorized access.",
  },
  {
    type: "heading",
    text: "Your Choices",
  },
  {
    type: "paragraph",
    text: "You can review and update your account details at any time by signing in, and you may contact us to ask what information we hold about you or to request that it be corrected or deleted, subject to our legitimate business and legal record-keeping needs.",
  },
  {
    type: "heading",
    text: "Contact Us",
  },
  {
    type: "paragraph",
    text: `If you have questions about this Privacy Policy or how your information is handled, contact us through our Contact page${brand.contact.email ? ` or at ${brand.contact.email}` : ""}. This page is a general draft intended for ongoing review.`,
  },
];

export default async function PrivacyPage() {
  const page = await cmsPageService.getPublishedBySlug("privacy");
  const blocks = page ? (page.body as CMSBlock[]) : FALLBACK_BLOCKS;
  const title = page?.title ?? "Privacy Policy";

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
