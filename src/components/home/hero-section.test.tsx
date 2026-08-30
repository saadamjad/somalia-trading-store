import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { HeroSection } from "@/components/home/hero-section";
import { brand } from "@/config/brand";
import type { Category } from "@/lib/types/product";
import homeMessages from "../../../messages/en/home.json";

function renderWithIntl(ui: React.ReactElement) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ home: homeMessages }}>
      {ui}
    </NextIntlClientProvider>
  );
}

const SAMPLE_CATEGORY: Category = {
  id: "cat-1",
  slug: "construction-materials",
  name: "Construction Materials",
  description: "Test category description.",
  shortDescription: "Test.",
  image: "https://example.com/image.jpg",
  heroImage: "https://example.com/hero.jpg",
  accentColor: "#8B7355",
  subcategories: [],
};

/**
 * Empty-state safety (Phase 12 requirement): the homepage hero must render sensible,
 * correct content whether or not an admin has configured an active `HOMEPAGE_HERO`
 * banner — a fresh/unconfigured deploy must never show a blank/broken hero.
 */
describe("HeroSection — CMS banner fallback", () => {
  it("falls back to the original static approved copy when no banner is active", () => {
    const html = renderWithIntl(
      <HeroSection categories={[SAMPLE_CATEGORY]} banner={null} />
    );

    expect(html).toContain("Built for");
    expect(html).toContain("Trusted in Trade.");
    expect(html).toContain(brand.description);
    expect(html).toContain("Explore Catalogue");
    expect(html).toContain('href="/shop"');
  });

  it("falls back to static copy when banner is simply omitted (undefined)", () => {
    const html = renderWithIntl(<HeroSection categories={[SAMPLE_CATEGORY]} />);
    expect(html).toContain("Built for");
  });

  it("uses the CMS-managed banner content when an active banner is provided", () => {
    const html = renderWithIntl(
      <HeroSection
        categories={[SAMPLE_CATEGORY]}
        banner={{
          title: "Big August Sale",
          subtitle: "20% off all road interlocks this month.",
          ctaText: "Shop the Sale",
          linkUrl: "/shop/road-interlocks",
        }}
      />
    );

    expect(html).toContain("Big August Sale");
    expect(html).toContain("20% off all road interlocks this month.");
    expect(html).toContain("Shop the Sale");
    expect(html).toContain('href="/shop/road-interlocks"');
    expect(html).not.toContain("Trusted in Trade.");
  });
});
