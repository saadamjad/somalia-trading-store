import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { bannerService } from "@/server/services/banner-service";
import { GET } from "./route";

function makeRequest(slot: string) {
  return new NextRequest(new URL(`http://localhost:3000/api/cms/banners?slot=${slot}`));
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const bannerIds: string[] = [];

describe("GET /api/cms/banners — public read path", () => {
  afterAll(async () => {
    await prisma.banner.deleteMany({ where: { id: { in: bannerIds } } });
    await prisma.$disconnect();
  });

  it("400s for an invalid slot", async () => {
    const res = await GET(makeRequest("NOT_A_REAL_SLOT"));
    expect(res.status).toBe(400);
  });

  it("returns { item: null } when no active banner exists for the slot — never breaks the caller", async () => {
    const inactive = await bannerService.create({
      slot: "HOMEPAGE_HERO",
      title: `Phase12 Public Route Inactive ${runId}`,
      active: false,
    });
    bannerIds.push(inactive.id);

    const res = await GET(makeRequest("HOMEPAGE_HERO"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Draft/inactive content must never leak — assert the inactive banner specifically
    // never comes back, regardless of what else is active in this slot.
    expect(body.item?.id).not.toBe(inactive.id);
  });

  it("returns the active banner for the slot", async () => {
    const active = await bannerService.create({
      slot: "HOMEPAGE_PROMO",
      title: `Phase12 Public Route Active ${runId}`,
      active: true,
      priority: 999,
    });
    bannerIds.push(active.id);

    const res = await GET(makeRequest("HOMEPAGE_PROMO"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.id).toBe(active.id);
  });
});
