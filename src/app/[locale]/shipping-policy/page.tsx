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
    title: "Shipping Policy",
    description: "How delivery works, including timelines and coverage areas.",
    path: "/shipping-policy",
    locale,
  });
}

// Fallback content shown when no "shipping-policy" CMSPage has been published yet —
// mirrors the FAQ page's pattern (src/app/faq/page.tsx) so a fresh deploy never shows a
// blank page. An admin publishing a "shipping-policy" CMSPage from /admin/cms overrides
// this entirely. This is a draft starting point for an admin to review and edit, not
// binding legal copy.
const FALLBACK_BLOCKS: CMSBlock[] = [
  {
    type: "paragraph",
    text: "This policy covers how we deliver orders placed through our website, across our construction materials, road interlocks, and fishing products ranges.",
  },
  {
    type: "heading",
    text: "Delivery Coverage",
  },
  {
    type: "paragraph",
    text: "We deliver to locations across Somalia. Coverage and delivery timelines can vary by area, so contact our team directly with your location for current availability, especially for bulky construction materials and road interlock orders.",
  },
  {
    type: "heading",
    text: "Delivery Timelines",
  },
  {
    type: "paragraph",
    text: "Delivery times depend on the product, quantity, and destination. In-stock items ordered online are generally prepared for dispatch within a few business days; bulk and project-scale orders arranged through a quote request follow a schedule agreed with our sales team.",
  },
  {
    type: "heading",
    text: "Delivery Charges",
  },
  {
    type: "paragraph",
    text: "Delivery charges, where applicable, are calculated based on order size, weight, and destination, and are shown at checkout or included in your quote before you confirm an order.",
  },
  {
    type: "heading",
    text: "Receiving Your Order",
  },
  {
    type: "paragraph",
    text: "Please inspect your order on delivery where possible. If anything arrives damaged or incomplete, contact us as soon as possible so we can resolve it quickly — see our Refund & Return Policy for next steps.",
  },
  {
    type: "heading",
    text: "Large or Project Deliveries",
  },
  {
    type: "paragraph",
    text: "For large construction material or road interlock deliveries, our team will coordinate delivery access, timing, and any site requirements with you directly ahead of dispatch.",
  },
  {
    type: "heading",
    text: "Questions",
  },
  {
    type: "paragraph",
    text: "For delivery questions on a specific order, reach out through our Contact page with your order details and our team will help. This page is a general draft intended for ongoing review.",
  },
];

export default async function ShippingPolicyPage() {
  const page = await cmsPageService.getPublishedBySlug("shipping-policy");
  const blocks = page ? (page.body as CMSBlock[]) : FALLBACK_BLOCKS;
  const title = page?.title ?? "Shipping Policy";

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
