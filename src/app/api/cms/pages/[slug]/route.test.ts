import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { cmsPageService } from "@/server/services/cms-page-service";
import { GET } from "./route";

function makeRequest(slug: string) {
  return new NextRequest(new URL(`http://localhost:3000/api/cms/pages/${slug}`));
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const pageIds: string[] = [];

describe("GET /api/cms/pages/[slug] — public read path", () => {
  afterAll(async () => {
    await prisma.cMSPage.deleteMany({ where: { id: { in: pageIds } } });
    await prisma.$disconnect();
  });

  it("404s for a slug that doesn't exist", async () => {
    const res = await GET(makeRequest(`nonexistent-${runId}`), {
      params: Promise.resolve({ slug: `nonexistent-${runId}` }),
    });
    expect(res.status).toBe(404);
  });

  it("404s for a draft (unpublished) page — never leaks draft content publicly, no auth required to hit this route", async () => {
    const slug = `phase12-public-draft-${runId}`;
    const draft = await cmsPageService.create({
      slug,
      title: "Draft, should not be public",
      body: [],
      published: false,
    });
    pageIds.push(draft.id);

    const res = await GET(makeRequest(slug), { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(404);
  });

  it("returns a published page", async () => {
    const slug = `phase12-public-published-${runId}`;
    const page = await cmsPageService.create({
      slug,
      title: "Published, should be public",
      body: [{ type: "paragraph", text: "Visible." }],
      published: true,
    });
    pageIds.push(page.id);

    const res = await GET(makeRequest(slug), { params: Promise.resolve({ slug }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.title).toBe("Published, should be public");
  });
});
