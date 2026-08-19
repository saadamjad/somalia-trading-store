import { prisma } from "@/server/lib/prisma";
import type { BannerSlot } from "@/generated/prisma/client";

export interface BannerCreateInput {
  slot: BannerSlot;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  linkUrl?: string | null;
  ctaText?: string | null;
  active?: boolean;
  priority?: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
}

export type BannerUpdateInput = Partial<BannerCreateInput>;

export const bannerRepository = {
  findAll() {
    return prisma.banner.findMany({ orderBy: [{ slot: "asc" }, { priority: "desc" }] });
  },

  findById(id: string) {
    return prisma.banner.findUnique({ where: { id } });
  },

  /** All active banners for a slot, highest-priority (then newest) first — scheduling
   * window filtering happens in the service layer, where "now" is easy to unit-test. */
  findActiveBySlot(slot: BannerSlot) {
    return prisma.banner.findMany({
      where: { slot, active: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  },

  create(data: BannerCreateInput) {
    return prisma.banner.create({ data });
  },

  update(id: string, data: BannerUpdateInput) {
    return prisma.banner.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.banner.delete({ where: { id } });
  },
};
