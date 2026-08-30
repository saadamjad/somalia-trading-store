-- CHECK constraints: Prisma's schema DSL has no native syntax for arbitrary CHECK
-- constraints at this Prisma version, so hand-added here — same pattern as
-- Inventory.quantity and Review.rating (see docs/DECISIONS.md).
ALTER TABLE "Coupon" ADD CONSTRAINT "value_non_negative" CHECK ("value" >= 0);
ALTER TABLE "Coupon" ADD CONSTRAINT "percentage_value_in_range" CHECK ("type" != 'PERCENTAGE' OR "value" <= 100);
ALTER TABLE "Coupon" ADD CONSTRAINT "times_used_non_negative" CHECK ("timesUsed" >= 0);
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "redemption_amount_non_negative" CHECK ("amount" >= 0);
