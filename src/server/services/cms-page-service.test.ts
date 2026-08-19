import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { cmsPageService, CMSPageNotFoundError } from "@/server/services/cms-page-service";
import type { CMSBlock } from "@/lib/validations/cms";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const pageIds: string[] = [];

function uniqueSlug(label: string) {
  return `phase12-cms-page-test-${label}-${runId}`;
}

describe("cmsPageService", () => {
  afterAll(async () => {
    await prisma.cMSPage.deleteMany({ where: { id: { in: pageIds } } });
    await prisma.$disconnect();
  });

  it("getPublishedBySlug returns null for a draft (unpublished) page — draft content never leaks publicly", async () => {
    const draft = await cmsPageService.create({
      slug: uniqueSlug("draft"),
      title: "Draft Page",
      body: [{ type: "paragraph", text: "Not yet live." }],
      published: false,
    });
    pageIds.push(draft.id);

    const result = await cmsPageService.getPublishedBySlug(draft.slug);
    expect(result).toBeNull();
  });

  it("getPublishedBySlug returns the page once published", async () => {
    const page = await cmsPageService.create({
      slug: uniqueSlug("published"),
      title: "Published Page",
      body: [{ type: "paragraph", text: "Live content." }],
      published: true,
    });
    pageIds.push(page.id);

    const result = await cmsPageService.getPublishedBySlug(page.slug);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Published Page");
  });

  it("getPublishedBySlug returns null for a slug that doesn't exist at all", async () => {
    const result = await cmsPageService.getPublishedBySlug(uniqueSlug("nonexistent"));
    expect(result).toBeNull();
  });

  it("adminGetById surfaces a draft page (admin path is not published-gated)", async () => {
    const draft = await cmsPageService.create({
      slug: uniqueSlug("admin-draft"),
      title: "Admin-visible Draft",
      body: [],
      published: false,
    });
    pageIds.push(draft.id);

    const result = await cmsPageService.adminGetById(draft.id);
    expect(result.published).toBe(false);
    expect(result.title).toBe("Admin-visible Draft");
  });

  it("adminGetById throws CMSPageNotFoundError for a missing id", async () => {
    await expect(cmsPageService.adminGetById("nonexistent-id")).rejects.toThrow(
      CMSPageNotFoundError
    );
  });

  it("update can flip published on/off", async () => {
    const page = await cmsPageService.create({
      slug: uniqueSlug("toggle"),
      title: "Toggle Page",
      body: [],
      published: false,
    });
    pageIds.push(page.id);

    expect(await cmsPageService.getPublishedBySlug(page.slug)).toBeNull();

    await cmsPageService.update(page.id, { published: true });
    expect(await cmsPageService.getPublishedBySlug(page.slug)).not.toBeNull();

    await cmsPageService.update(page.id, { published: false });
    expect(await cmsPageService.getPublishedBySlug(page.slug)).toBeNull();
  });

  it(
    "stores a <script> payload in a paragraph block as inert plain text, unchanged — " +
      "proving the structured-JSON design never interprets admin-supplied content as HTML",
    async () => {
      const payload = '<script>alert(1)</script><img src=x onerror="alert(2)">';
      const body: CMSBlock[] = [{ type: "paragraph", text: payload }];

      const page = await cmsPageService.create({
        slug: uniqueSlug("xss"),
        title: "XSS Probe Page",
        body,
        published: true,
      });
      pageIds.push(page.id);

      const fetched = await cmsPageService.getPublishedBySlug(page.slug);
      const storedBlocks = fetched?.body as CMSBlock[];

      expect(storedBlocks).toHaveLength(1);
      expect(storedBlocks[0]).toEqual({ type: "paragraph", text: payload });
    }
  );
});
