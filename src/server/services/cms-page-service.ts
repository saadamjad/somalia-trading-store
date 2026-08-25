import { cachedRead, revalidateTag } from "@/lib/server-cache";
import { cmsPageRepository } from "@/server/repositories/cms-page-repository";
import { cacheTags } from "@/lib/cache-tags";
import type { CMSPageCreateInput, CMSPageUpdateInput } from "@/lib/validations/cms";
import type { CMSPage, Prisma } from "@/generated/prisma/client";

export class CMSPageNotFoundError extends Error {
  constructor() {
    super("Page not found.");
    this.name = "CMSPageNotFoundError";
  }
}

export interface CMSPageView {
  id: string;
  slug: string;
  title: string;
  body: unknown;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

function toView(row: CMSPage): CMSPageView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * CMSPage CRUD (admin) plus the public read path. `body` is always a validated array
 * of structured blocks (src/lib/validations/cms.ts) by the time it reaches here — never
 * raw HTML — see the CMSPage schema comment for the full XSS-prevention rationale.
 */
const getPublishedBySlugCached = cachedRead(
  async (slug: string) => {
    const row = await cmsPageRepository.findPublishedBySlug(slug);
    return row ? toView(row) : null;
  },
  ["cms-pages:getPublishedBySlug"],
  { tags: [cacheTags.cmsPages] }
);

export const cmsPageService = {
  /** Admin — every page regardless of published state. Caller must have checked `cms.view`. */
  async adminList(): Promise<CMSPageView[]> {
    const rows = await cmsPageRepository.findAll();
    return rows.map(toView);
  },

  /** Admin — single page by id, regardless of published state. */
  async adminGetById(id: string): Promise<CMSPageView> {
    const row = await cmsPageRepository.findById(id);
    if (!row) throw new CMSPageNotFoundError();
    return toView(row);
  },

  /**
   * Public read path — the ONLY method this service exposes that a public route may
   * call. Returns null (never a draft page) if no page with this slug is published,
   * so an unpublished/nonexistent page never leaks — callers render their own fallback.
   */
  async getPublishedBySlug(slug: string): Promise<CMSPageView | null> {
    return getPublishedBySlugCached(slug);
  },

  async create(input: CMSPageCreateInput): Promise<CMSPageView> {
    const row = await cmsPageRepository.create({
      slug: input.slug,
      title: input.title,
      body: input.body as unknown as Prisma.InputJsonValue,
      published: input.published ?? false,
    });
    revalidateTag(cacheTags.cmsPages);
    return toView(row);
  },

  async update(id: string, input: CMSPageUpdateInput): Promise<CMSPageView> {
    const existing = await cmsPageRepository.findById(id);
    if (!existing) throw new CMSPageNotFoundError();

    const row = await cmsPageRepository.update(id, {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body as unknown as Prisma.InputJsonValue } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
    });
    revalidateTag(cacheTags.cmsPages);
    return toView(row);
  },

  async delete(id: string): Promise<void> {
    const existing = await cmsPageRepository.findById(id);
    if (!existing) throw new CMSPageNotFoundError();
    await cmsPageRepository.delete(id);
    revalidateTag(cacheTags.cmsPages);
  },
};
