import { cachedRead, revalidateTag } from "@/lib/server-cache";
import { bannerRepository } from "@/server/repositories/banner-repository";
import { cacheTags } from "@/lib/cache-tags";
import type { BannerCreateInput, BannerUpdateInput } from "@/lib/validations/cms";
import type { Banner, BannerSlot } from "@/generated/prisma/client";

export class BannerNotFoundError extends Error {
  constructor() {
    super("Banner not found.");
    this.name = "BannerNotFoundError";
  }
}

export interface BannerView {
  id: string;
  slot: BannerSlot;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  ctaText: string | null;
  active: boolean;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toView(row: Banner): BannerView {
  return {
    id: row.id,
    slot: row.slot,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.imageUrl,
    linkUrl: row.linkUrl,
    ctaText: row.ctaText,
    active: row.active,
    priority: row.priority,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isWithinSchedule(row: Banner, now: Date): boolean {
  if (row.startsAt && row.startsAt > now) return false;
  if (row.endsAt && row.endsAt < now) return false;
  return true;
}

/**
 * Banner CRUD (admin) plus the public read path. Text fields are always rendered as
 * plain React text and `imageUrl`/`linkUrl` are scheme-validated at input time
 * (src/lib/validations/cms.ts) — see the Banner schema comment for the full
 * XSS-prevention rationale.
 */
/**
 * Cached at the "all active rows for this slot" level, not the final scheduling
 * decision — `now` legitimately changes every call and can't be part of the cache
 * key, but the underlying rows only change when an admin mutates a banner (which
 * calls `revalidateTag` below), so caching here still eliminates the DB round-trip
 * on every homepage request while keeping schedule-window evaluation exact.
 */
const findActiveBySlotCached = cachedRead(
  (slot: BannerSlot) => bannerRepository.findActiveBySlot(slot),
  ["banners:findActiveBySlot"],
  { tags: [cacheTags.banners] }
);

export const bannerService = {
  /** Admin — every banner regardless of active/scheduling state. Caller must have checked `cms.view`. */
  async adminList(): Promise<BannerView[]> {
    const rows = await bannerRepository.findAll();
    return rows.map(toView);
  },

  async adminGetById(id: string): Promise<BannerView> {
    const row = await bannerRepository.findById(id);
    if (!row) throw new BannerNotFoundError();
    return toView(row);
  },

  /**
   * Public read path — the ONLY method this service exposes that a public route/page
   * may call. Returns the single highest-priority banner for `slot` that is both
   * `active` and currently within its optional schedule window, or null if none —
   * never an inactive/out-of-window banner. Callers (e.g. the homepage) render their
   * own fallback static content when this returns null, so an empty/unconfigured
   * Banner table never breaks a public page.
   */
  async getActiveForSlot(slot: BannerSlot, now: Date = new Date()): Promise<BannerView | null> {
    const rows = await findActiveBySlotCached(slot);
    const eligible = rows.find((row) => isWithinSchedule(row, now));
    return eligible ? toView(eligible) : null;
  },

  async create(input: BannerCreateInput): Promise<BannerView> {
    const row = await bannerRepository.create({
      slot: input.slot,
      title: input.title,
      subtitle: input.subtitle ?? null,
      imageUrl: input.imageUrl ?? null,
      linkUrl: input.linkUrl ?? null,
      ctaText: input.ctaText ?? null,
      active: input.active ?? false,
      priority: input.priority ?? 0,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });
    revalidateTag(cacheTags.banners);
    return toView(row);
  },

  async update(id: string, input: BannerUpdateInput): Promise<BannerView> {
    const existing = await bannerRepository.findById(id);
    if (!existing) throw new BannerNotFoundError();

    const row = await bannerRepository.update(id, input);
    revalidateTag(cacheTags.banners);
    return toView(row);
  },

  async delete(id: string): Promise<void> {
    const existing = await bannerRepository.findById(id);
    if (!existing) throw new BannerNotFoundError();
    await bannerRepository.delete(id);
    revalidateTag(cacheTags.banners);
  },
};
