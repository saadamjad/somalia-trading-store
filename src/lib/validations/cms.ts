import { z } from "zod";

/**
 * Structured content blocks for `CMSPage.body`. Deliberately NOT raw HTML/markdown —
 * see the schema comment on `CMSPage` for the XSS-prevention rationale. Add new block
 * types here (and a matching case in src/components/cms/page-renderer.tsx) rather than
 * ever introducing a free-form HTML field.
 */
const headingBlockSchema = z.object({
  type: z.literal("heading"),
  text: z.string().trim().min(1).max(200),
});

const paragraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: z.string().trim().min(1).max(4000),
});

const faqItemBlockSchema = z.object({
  type: z.literal("faqItem"),
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(4000),
});

export const cmsBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  paragraphBlockSchema,
  faqItemBlockSchema,
]);

export type CMSBlock = z.infer<typeof cmsBlockSchema>;

export const cmsPageCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, hyphen-separated."),
  title: z.string().trim().min(1).max(200),
  body: z.array(cmsBlockSchema).max(100),
  published: z.boolean().optional(),
});

export const cmsPageUpdateSchema = cmsPageCreateSchema.partial();

export type CMSPageCreateInput = z.infer<typeof cmsPageCreateSchema>;
export type CMSPageUpdateInput = z.infer<typeof cmsPageUpdateSchema>;

/**
 * Accepts an absolute http(s) URL or a site-relative path (`/images/...`). Rejects
 * `javascript:`, `data:`, and any other scheme — these fields end up in `href`/`src`
 * attributes, so a malicious scheme is the actual XSS vector for URL-shaped fields
 * (plain text fields are safe by construction via React's escaping; see CMSPage's
 * schema comment).
 */
const safeUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "URL must be an absolute http(s) link or a relative path starting with /."
  );

export const bannerSlotSchema = z.enum(["HOMEPAGE_HERO", "HOMEPAGE_PROMO"]);

export const bannerCreateSchema = z
  .object({
    slot: bannerSlotSchema,
    title: z.string().trim().min(1).max(200),
    subtitle: z.string().trim().max(500).nullable().optional(),
    imageUrl: safeUrlSchema.nullable().optional(),
    linkUrl: safeUrlSchema.nullable().optional(),
    ctaText: z.string().trim().max(60).nullable().optional(),
    active: z.boolean().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.startsAt <= data.endsAt,
    { message: "startsAt must be before endsAt.", path: ["endsAt"] }
  );

export const bannerUpdateSchema = z
  .object({
    slot: bannerSlotSchema.optional(),
    title: z.string().trim().min(1).max(200).optional(),
    subtitle: z.string().trim().max(500).nullable().optional(),
    imageUrl: safeUrlSchema.nullable().optional(),
    linkUrl: safeUrlSchema.nullable().optional(),
    ctaText: z.string().trim().max(60).nullable().optional(),
    active: z.boolean().optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.startsAt <= data.endsAt,
    { message: "startsAt must be before endsAt.", path: ["endsAt"] }
  );

export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
