import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { authService } from "@/server/services/auth-service";
import {
  couponService,
  CouponNotFoundError,
  CouponNotApplicableError,
} from "@/server/services/coupon-service";

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const testEmails: string[] = [];
const couponCodes: string[] = [];

function uniqueEmail(label: string) {
  const email = `coupon-service-${label}-${runId}@example.test`;
  testEmails.push(email);
  return email;
}

function uniqueCode(label: string) {
  const code = `TEST-${label.toUpperCase()}-${runId}`;
  couponCodes.push(code);
  return code;
}

async function createCustomer(label: string) {
  return authService.register({
    name: `Coupon Service Test ${label}`,
    email: uniqueEmail(label),
    password: "PlainTextPass1",
  });
}

describe("couponService", () => {
  afterAll(async () => {
    await prisma.couponRedemption.deleteMany({ where: { coupon: { code: { in: couponCodes } } } });
    await prisma.coupon.deleteMany({ where: { code: { in: couponCodes } } });
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });
    await prisma.$disconnect();
  });

  it("computes a PERCENTAGE discount, capped by maxDiscountAmount", async () => {
    const code = uniqueCode("pct-cap");
    await prisma.coupon.create({
      data: { code, type: "PERCENTAGE", value: "50", maxDiscountAmount: "10.00" },
    });

    // 50% of 100 = 50, but capped at 10.
    const preview = await couponService.validate(code, 100, null);
    expect(preview.discountAmount).toBe(10);
  });

  it("computes a FIXED discount, never exceeding the subtotal", async () => {
    const code = uniqueCode("fixed-cap");
    await prisma.coupon.create({ data: { code, type: "FIXED", value: "40.00" } });

    const preview = await couponService.validate(code, 25, null);
    expect(preview.discountAmount).toBe(25); // capped at subtotal, not 40
  });

  it("throws CouponNotFoundError for an unknown code", async () => {
    await expect(couponService.validate("DOES-NOT-EXIST", 50, null)).rejects.toThrow(
      CouponNotFoundError
    );
  });

  it("rejects an inactive coupon", async () => {
    const code = uniqueCode("inactive");
    await prisma.coupon.create({ data: { code, type: "FIXED", value: "5.00", active: false } });

    await expect(couponService.validate(code, 50, null)).rejects.toThrow(CouponNotApplicableError);
  });

  it("rejects a coupon below its minOrderAmount", async () => {
    const code = uniqueCode("min-order");
    await prisma.coupon.create({
      data: { code, type: "FIXED", value: "5.00", minOrderAmount: "100.00" },
    });

    await expect(couponService.validate(code, 50, null)).rejects.toThrow(CouponNotApplicableError);
    const preview = await couponService.validate(code, 150, null);
    expect(preview.discountAmount).toBe(5);
  });

  it("rejects an expired coupon and one not yet active", async () => {
    const expiredCode = uniqueCode("expired");
    await prisma.coupon.create({
      data: { code: expiredCode, type: "FIXED", value: "5.00", endsAt: new Date("2020-01-01") },
    });
    await expect(couponService.validate(expiredCode, 50, null)).rejects.toThrow(
      CouponNotApplicableError
    );

    const futureCode = uniqueCode("future");
    await prisma.coupon.create({
      data: { code: futureCode, type: "FIXED", value: "5.00", startsAt: new Date("2099-01-01") },
    });
    await expect(couponService.validate(futureCode, 50, null)).rejects.toThrow(
      CouponNotApplicableError
    );
  });

  it("rejects a coupon that has reached its global usage limit", async () => {
    const code = uniqueCode("limit-reached");
    await prisma.coupon.create({
      data: { code, type: "FIXED", value: "5.00", usageLimit: 1, timesUsed: 1 },
    });

    await expect(couponService.validate(code, 50, null)).rejects.toThrow(CouponNotApplicableError);
  });

  it("requires login for a coupon with a perCustomerLimit, and rejects once a customer has used it up", async () => {
    const code = uniqueCode("per-customer");
    const coupon = await prisma.coupon.create({
      data: { code, type: "FIXED", value: "5.00", perCustomerLimit: 1 },
    });
    const customer = await createCustomer("per-customer");

    await expect(couponService.validate(code, 50, null)).rejects.toThrow(CouponNotApplicableError);

    // No redemption yet — should succeed for this logged-in customer.
    const preview = await couponService.validate(code, 50, customer.id);
    expect(preview.discountAmount).toBe(5);

    // Simulate a prior redemption for this customer, then check it's blocked.
    const fakeOrder = await prisma.order.create({
      data: {
        orderNumber: `ORD-COUPON-TEST-${runId}`,
        userId: customer.id,
        subtotal: "50.00",
        total: "45.00",
        shippingRecipientName: "Test",
        shippingPhone: "+252-61-000-0000",
        shippingLine1: "Test Street",
        shippingCity: "Mogadishu",
        shippingCountry: "Somalia",
      },
    });
    await prisma.couponRedemption.create({
      data: { couponId: coupon.id, userId: customer.id, orderId: fakeOrder.id, amount: "5.00" },
    });

    await expect(couponService.validate(code, 50, customer.id)).rejects.toThrow(
      CouponNotApplicableError
    );

    await prisma.couponRedemption.deleteMany({ where: { orderId: fakeOrder.id } });
    await prisma.order.delete({ where: { id: fakeOrder.id } });
  });
});
