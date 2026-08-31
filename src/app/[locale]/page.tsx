import { HeroSection } from "@/components/home/hero-section";
import { ShopByCategory } from "@/components/home/shop-by-category";
import { OurStorySection } from "@/components/home/our-story-section";
import { FeaturedProductsSection } from "@/components/home/featured-products-section";
import { ReviewsSection } from "@/components/home/reviews-section";
import { StatsTrustSection } from "@/components/home/stats-trust-section";
import { CTABanner, TrustStrip } from "@/components/home/trust-strip";
import { WhyChooseSection } from "@/components/home/why-choose-section";
import { PromoBanner } from "@/components/home/promo-banner";
import { createPageMetadata } from "@/config/seo";
import { brand } from "@/config/brand";
import { isLocale, defaultLocale } from "@/config/i18n";
import { productService } from "@/server/services/product-service";
import { bannerService } from "@/server/services/banner-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  return {
    ...createPageMetadata({
      title: brand.name,
      description: brand.description,
      path: "/",
      locale,
    }),
    // The homepage's title IS the brand name — it should render as just "Foley
    // General Trading (LLC)", not "Foley General Trading (LLC) | Foley General
    // Trading (LLC)". `absolute` opts out of the root layout's title template
    // (`%s | ${brand.name}`) for this one page; every other page still gets the
    // template applied normally via the plain string `title` createPageMetadata
    // returns.
    title: { absolute: brand.name },
  };
}

export default async function HomePage() {
  const [categories, heroBanner, promoBanner, featuredProducts] = await Promise.all([
    productService.getCategories(),
    bannerService.getActiveForSlot("HOMEPAGE_HERO"),
    bannerService.getActiveForSlot("HOMEPAGE_PROMO"),
    productService.getFeatured(),
  ]);

  return (
    <>
      <HeroSection categories={categories} banner={heroBanner} />
      <OurStorySection />
      <FeaturedProductsSection products={featuredProducts} />
      <ShopByCategory categories={categories} />
      <StatsTrustSection />
      {promoBanner && <PromoBanner banner={promoBanner} />}
      <WhyChooseSection />
      <ReviewsSection />
      <TrustStrip />
      <CTABanner />
    </>
  );
}
