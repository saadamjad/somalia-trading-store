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

export const metadata = createPageMetadata({
  title: brand.name,
  description: brand.description,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ShopByCategory />
      <StatsTrustSection />
      <OurStorySection />
      <FeaturedProducts />
      <WhyChooseSection />
      <ReviewsSection />
      <TrustStrip />
      <CTABanner />
    </>
  );
}
