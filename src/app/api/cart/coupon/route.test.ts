import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { POST } from "./route";

vi.mock("@/server/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/session")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "@/server/auth/session";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const couponCodes: string[] = [];

function uniqueCode(label: string) {
  const code = `CART-COUPON-ROUTE-${label.toUpperCase()}-${runId}`;
  couponCodes.push(code);
  return code;
}

function postJson(url: string, body: unknown) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/cart/coupon", () => {
  afterAll(async () => {
    await prisma.coupon.deleteMany({ where: { code: { in: couponCodes } } });
    await prisma.$disconnect();
  });

  it("returns a discount preview for a valid coupon, with no session required (guest)", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const code = uniqueCode("guest-ok");
    await prisma.coupon.create({ data: { code, type: "FIXED", value: "5.00" } });

    const res = await POST(postJson("http://localhost:3000/api/cart/coupon", { code, subtotal: 50 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.item.discountAmount).toBe(5);
  });

  it("returns 404 for an unknown coupon code", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await POST(
      postJson("http://localhost:3000/api/cart/coupon", { code: "NOT-REAL", subtotal: 50 })
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for a coupon below its minimum order amount", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const code = uniqueCode("min-order");
    await prisma.coupon.create({
      data: { code, type: "FIXED", value: "5.00", minOrderAmount: "1000.00" },
    });

    const res = await POST(postJson("http://localhost:3000/api/cart/coupon", { code, subtotal: 10 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a missing/invalid body", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const res = await POST(postJson("http://localhost:3000/api/cart/coupon", { subtotal: 10 }));
    expect(res.status).toBe(400);
  });
});
