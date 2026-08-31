import { FadeIn } from "@/components/ui/motion";
import { PageRenderer } from "@/components/cms/page-renderer";
import { createPageMetadata } from "@/config/seo";
import { isLocale, defaultLocale } from "@/config/i18n";
import { cmsPageService } from "@/server/services/cms-page-service";
import type { CMSBlock } from "@/lib/validations/cms";
import { brand } from "@/config/brand";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return createPageMetadata({
    title: "Terms & Conditions",
    description: "The terms and conditions that govern use of our website and orders.",
    path: "/terms",
    locale,
  });
}

// Fallback content shown when no "terms" CMSPage has been published yet — mirrors the
// FAQ page's pattern (src/app/faq/page.tsx) so a fresh deploy never shows a blank page.
// An admin publishing a "terms" CMSPage from /admin/cms overrides this entirely. This is
// a draft starting point for an admin to review and edit, not binding legal copy.
const FALLBACK_BLOCKS: CMSBlock[] = [
  {
    type: "paragraph",
    text: `These Terms & Conditions govern your use of the ${brand.name} website and any orders placed through it. By browsing our catalogue, submitting a quote request, or completing a purchase, you agree to the terms below.`,
  },
  {
    type: "heading",
    text: "Orders & Pricing",
  },
  {
    type: "paragraph",
    text: "Prices shown on the site are quoted in the currency displayed at checkout and are subject to change without notice. Placing an order online is an offer to purchase, which we may accept, decline, or adjust (for example if a listed price or stock level was incorrect) before it is confirmed. Bulk and project-scale pricing is handled separately through the Quote Request flow.",
  },
  {
    type: "heading",
    text: "Product Information",
  },
  {
    type: "paragraph",
    text: "We make reasonable efforts to describe products, materials, dimensions, and specifications accurately, but colours, finishes, and exact measurements may vary slightly from what is shown online. If a product you receive differs materially from its listing, contact us and we will make it right.",
  },
  {
    type: "heading",
    text: "Payment & Delivery",
  },
  {
    type: "paragraph",
    text: "Accepted payment methods and delivery arrangements are confirmed at checkout or during quote follow-up. Delivery timelines are estimates and may vary by location and product availability across our construction materials, road interlocks, and fishing products ranges.",
  },
  {
    type: "heading",
    text: "Account Responsibilities",
  },
  {
    type: "paragraph",
    text: "If you create an account, you are responsible for keeping your login credentials secure and for all activity under your account. Let us know immediately if you suspect unauthorized access.",
  },
  {
    type: "heading",
    text: "Limitation of Liability",
  },
  {
    type: "paragraph",
    text: `To the fullest extent permitted by law, ${brand.name} is not liable for indirect or consequential losses arising from use of this website or the products purchased through it, beyond the remedies described in our Refund & Return Policy.`,
  },
  {
    type: "heading",
    text: "Changes to These Terms",
  },
  {
    type: "paragraph",
    text: "We may update these Terms & Conditions from time to time as our business and product ranges evolve. Continued use of the website after changes are posted constitutes acceptance of the revised terms. This page is a general draft intended for ongoing review, not a final legal document — for anything time-sensitive or high-value, please contact us directly.",
  },
];

export default async function TermsPage() {
  const page = await cmsPageService.getPublishedBySlug("terms");
  const blocks = page ? (page.body as CMSBlock[]) : FALLBACK_BLOCKS;
  const title = page?.title ?? "Terms & Conditions";

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
