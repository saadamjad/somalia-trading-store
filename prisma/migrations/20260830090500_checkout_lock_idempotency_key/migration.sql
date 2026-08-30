-- CheckoutLock's uniqueness moves from userId alone to (userId, key): a per-checkout-
-- attempt idempotency key, not a per-user time-window debounce. The table has no rows
-- yet (added and never used in the previous migration), so this is safe to apply
-- directly rather than as a data migration.
DROP INDEX IF EXISTS "CheckoutLock_userId_key";

ALTER TABLE "CheckoutLock" ADD COLUMN "key" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CheckoutLock" ALTER COLUMN "key" DROP DEFAULT;

CREATE UNIQUE INDEX "CheckoutLock_userId_key_key" ON "CheckoutLock"("userId", "key");
