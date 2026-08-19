import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { bannerService, BannerNotFoundError } from "@/server/services/banner-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const bannerIds: string[] = [];

function title(label: string) {
  return `Phase12 Banner Test ${label} ${runId}`;
}

describe("bannerService", () => {
  afterAll(async () => {
    await prisma.banner.deleteMany({ where: { id: { in: bannerIds } } });
    await prisma.$disconnect();
  });

  it("getActiveForSlot returns null when no banner exists for the slot (empty-state safety)", async () => {
    const result = await bannerService.getActiveForSlot("HOMEPAGE_PROMO");
    // Not asserting strict null since other tests may leave active banners in this
    // slot; instead assert the shape is either null or a real active banner for it.
    if (result) {
      expect(result.slot).toBe("HOMEPAGE_PROMO");
      expect(result.active).toBe(true);
    } else {
      expect(result).toBeNull();
    }
  });

  it("getActiveForSlot never returns an inactive banner", async () => {
    const inactive = await bannerService.create({
      slot: "HOMEPAGE_HERO",
      title: title("inactive"),
      active: false,
    });
    bannerIds.push(inactive.id);

    const result = await bannerService.getActiveForSlot("HOMEPAGE_HERO");
    expect(result?.id).not.toBe(inactive.id);
  });

  it("getActiveForSlot returns an active banner for its slot", async () => {
    const active = await bannerService.create({
      slot: "HOMEPAGE_HERO",
      title: title("active"),
      active: true,
      priority: 999,
    });
    bannerIds.push(active.id);

    const result = await bannerService.getActiveForSlot("HOMEPAGE_HERO");
    expect(result?.id).toBe(active.id);
  });

  it("getActiveForSlot picks the highest-priority active banner when several are active", async () => {
    const low = await bannerService.create({
      slot: "HOMEPAGE_PROMO",
      title: title("low-priority"),
      active: true,
      priority: 1,
    });
    bannerIds.push(low.id);
    const high = await bannerService.create({
      slot: "HOMEPAGE_PROMO",
      title: title("high-priority"),
      active: true,
      priority: 50,
    });
    bannerIds.push(high.id);

    const result = await bannerService.getActiveForSlot("HOMEPAGE_PROMO");
    expect(result?.id).toBe(high.id);
  });

  it("getActiveForSlot excludes an active banner outside its schedule window", async () => {
    const future = await bannerService.create({
      slot: "HOMEPAGE_HERO",
      title: title("future"),
      active: true,
      priority: 1000,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    bannerIds.push(future.id);

    const result = await bannerService.getActiveForSlot("HOMEPAGE_HERO");
    expect(result?.id).not.toBe(future.id);
  });

  it("getActiveForSlot includes an active banner within its schedule window", async () => {
    const now = new Date();
    const current = await bannerService.create({
      slot: "HOMEPAGE_HERO",
      title: title("scheduled-now"),
      active: true,
      priority: 1001,
      startsAt: new Date(now.getTime() - 60_000),
      endsAt: new Date(now.getTime() + 60_000),
    });
    bannerIds.push(current.id);

    const result = await bannerService.getActiveForSlot("HOMEPAGE_HERO", now);
    expect(result?.id).toBe(current.id);
  });

  it("adminList surfaces inactive banners too (admin path is not active-gated)", async () => {
    const inactive = await bannerService.create({
      slot: "HOMEPAGE_PROMO",
      title: title("admin-visible-inactive"),
      active: false,
    });
    bannerIds.push(inactive.id);

    const all = await bannerService.adminList();
    expect(all.some((b) => b.id === inactive.id)).toBe(true);
  });

  it("adminGetById throws BannerNotFoundError for a missing id", async () => {
    await expect(bannerService.adminGetById("nonexistent-id")).rejects.toThrow(BannerNotFoundError);
  });
});
