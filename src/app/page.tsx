import { HeroSection } from "@/components/home/hero-section";
import {
  FeaturedProducts,
  ShopByCategory,
} from "@/components/home/shop-by-category";
import { OurStorySection } from "@/components/home/our-story-section";
import { ReviewsSection } from "@/components/home/reviews-section";
import { StatsTrustSection } from "@/components/home/stats-trust-section";
import { CTABanner, TrustStrip } from "@/components/home/trust-strip";
import { WhyChooseSection } from "@/components/home/why-choose-section";
import { createPageMetadata } from "@/config/seo";
import { brand } from "@/config/brand";
import { productService } from "@/server/services/product-service";

export const metadata = createPageMetadata({
  title: brand.name,
  description: brand.description,
  path: "/",
});

export default async function HomePage() {
  const [categories, featured] = await Promise.all([
    productService.getCategories(),
    productService.getFeatured(),
  ]);

  return (
    <>
      <HeroSection categories={categories} />
      <ShopByCategory categories={categories} />
      <StatsTrustSection />
      <OurStorySection />
      <FeaturedProducts products={featured} />
      <WhyChooseSection />
      <ReviewsSection />
      <TrustStrip />
      <CTABanner />
    </>
  );
}
