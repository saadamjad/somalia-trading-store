import { afterAll, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "@/server/lib/prisma";
import { cmsPageService } from "@/server/services/cms-page-service";
import TermsPage from "./page";

/**
 * Proves the CMS-fallback pattern (mirrors src/app/faq/page.tsx, Phase 12): the page
 * renders its hardcoded FALLBACK_BLOCKS when no "terms" CMSPage is published, and
 * renders the published CMSPage's own content instead once one exists — so a fresh
 * deploy is never blank, and an admin publishing content from /admin/cms takes effect.
 */
describe("TermsPage — CMS fallback pattern", () => {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const testSlug = `terms`; // the real slug this page reads — see afterAll cleanup

  afterAll(async () => {
    await prisma.cMSPage.deleteMany({ where: { slug: testSlug } });
    await prisma.$disconnect();
  });

  it("renders the hardcoded fallback content when no 'terms' CMSPage is published", async () => {
    // Ensure a clean slate — no published "terms" row.
    await prisma.cMSPage.deleteMany({ where: { slug: testSlug } });

    const html = renderToStaticMarkup(await TermsPage());

    expect(html).toContain("Terms &amp; Conditions");
    expect(html).toContain("Orders &amp; Pricing");
  });

  it("renders the published CMSPage's own content once one exists, overriding the fallback", async () => {
    await cmsPageService.create({
      slug: testSlug,
      title: `Custom Terms ${runId}`,
      body: [{ type: "paragraph", text: `Custom terms content ${runId}.` }],
      published: true,
    });

    const html = renderToStaticMarkup(await TermsPage());

    expect(html).toContain(`Custom Terms ${runId}`);
    expect(html).toContain(`Custom terms content ${runId}.`);
    // The hardcoded fallback copy must not leak through once CMS content exists.
    expect(html).not.toContain("Orders &amp; Pricing");
  });
});
