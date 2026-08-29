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
import { productService } from "@/server/services/product-service";
import { bannerService } from "@/server/services/banner-service";

export const metadata = createPageMetadata({
  title: brand.name,
  description: brand.description,
  path: "/",
});

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
