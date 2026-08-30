# Database Map

This is a summary of every Prisma model, grouped by domain. **`prisma/schema.prisma` is the authoritative source — this is a map, not a replacement.** Every model in the schema has its own detailed comment explaining the design rationale; read the schema directly when you need the "why", not just the "what". Field lists below are non-exhaustive (timestamps, ids, and obvious FKs are usually omitted).

## Identity

- **`User`** — email, bcrypt `passwordHash`, name, phone, `emailVerified` (nullable — no verification gate is enforced yet, D-010). Belongs to one `Role`. Has one `Cart`, one `Wishlist` (both created lazily on first use, not at registration), many `Address`, `Order`, `Quote` (nullable — guest quotes have no `User`), `RefundRequest` (two relations: made vs. reviewed), `Notification`.
- **`Role`** — a name (`customer`, `staff`, `admin`, `super_admin` — see `BUSINESS_RULES.md` for what's actually seeded vs. the richer, still-aspirational role model described elsewhere). Has many `RolePermission`.
- **`Permission`** — a unique `key` string, `"<resource>.<action>"` convention (e.g. `products.create`).
- **`RolePermission`** — join table, `@@id([roleId, permissionId])`.
- **`PasswordResetToken`** — token, `expiresAt`, `usedAt`. Belongs to one `User`. No real email delivery sends this — it's logged to the server console (D-010).

## Catalog

- **`Category`** — slug, name, description, hero/banner image fields, `accentColor`. Self-referential (`parentId`/`children`) for nesting, though the seeded data is flat. Has many `Product`.
- **`Product`** — slug, sku (unique, nullable), name, description, `categoryId`, `subcategory` (free-text facet, not its own table), `price`/`compareAtPrice` (`Decimal(12,2)`), `currency` (defaults `"USD"`, confirmed final per D-006), `priceUnit` (e.g. "sqm"), `images` (string array), `specifications` (JSON), `tags`, `purchasingMode` (`BUY_ONLINE`/`QUOTE_ONLY`/`BOTH`), `availability` enum, `featured`. Has one `Inventory`, many `InventoryTransaction`, `CartItem`, `WishlistItem`, `OrderItem`, `QuoteItem`, `ProductVariant`, `Review`.
- **`ProductVariant`** — optional per product (zero rows = plain single-SKU product, unchanged behavior). `sku` (unique), `attributes` (JSON, e.g. `{size, color}`), `price` (nullable override — falls back to `Product.price` at order-creation time), `image`, `active`. Has one `VariantInventory`, many `VariantInventoryTransaction`, `CartItem`, `OrderItem`. Deliberately a PARALLEL model to `Product`/`Inventory` rather than a nullable-variantId retrofit — zero regression risk to the existing single-SKU catalog and its atomic no-oversell guarantee.

## Inventory

- **`Inventory`** — 1:1 with `Product`. `quantity` (must never go negative — enforced by a hand-added DB CHECK constraint in the migration SQL *and* an atomic conditional UPDATE at the app layer), `lowStockThreshold` (default 10).
- **`InventoryTransaction`** — full audit log: `previousQuantity`, `adjustment` (signed), `newQuantity`, `reason` (`InventoryChangeReason` enum: `MANUAL_ADJUSTMENT`, `RESTOCK`, `CORRECTION`, `ORDER_PLACED`, `ORDER_CANCELLED`), optional `note`, `actorId` (required — every adjustment has an actor). Never mutated or deleted; one row per adjustment.
- **`VariantInventory`** — mirrors `Inventory` exactly (1:1 with `ProductVariant`, same `quantity`/`lowStockThreshold` shape and the same atomic conditional-UPDATE no-oversell guarantee). Kept parallel to `Inventory` rather than a nullable-variantId column so `Inventory.productId @unique` never has to change.
- **`VariantInventoryTransaction`** — mirrors `InventoryTransaction` exactly for the variant stock path (same audit fields, required `actorId`).

## Commerce (pre-order)

- **`Cart`** / **`CartItem`** — 1:1 `Cart` per `User`, lazily created. `CartItem` has `quantity` and a nullable `variantId` (no price snapshot — price is always read live from `Product`/`ProductVariant`). Uniqueness is enforced by a pair of hand-added PARTIAL indexes (Prisma's DSL has no WHERE-clause syntax): one on `(cartId, productId)` `WHERE variantId IS NULL` (one row per non-variant product, the original invariant, unchanged), one on `(cartId, productId, variantId)` `WHERE variantId IS NOT NULL` (one row per product+variant combination) — not a plain `@@unique([cartId, productId])`, which would either block two different variants of the same product coexisting, or (via Postgres's NULL-never-equal semantics) not dedupe non-variant rows at all.
- **`Wishlist`** / **`WishlistItem`** — same shape/rationale as Cart, no quantity (a product either is or isn't on the wishlist). `@@unique([wishlistId, productId])` is the DB-level duplicate guard.
- **`Address`** — `recipientName`, `phone`, `line1`/`line2`, `city`, `region`, `postalCode` (optional — Somalia addressing doesn't always use one), `country`, `isDefault`. Belongs to one `User`. Every read/write path scopes by session `userId`, never a client-supplied one.

## Orders

- **`Order`** — `orderNumber` (unique, generated, retried on collision), `status` (`OrderStatus`), `paymentStatus` (`PaymentStatus`, kept structurally independent — see `BUSINESS_RULES.md`), shipping fields copied inline (never a live `Address` FK, so editing/deleting the source address later can't alter a past order's "shipped to"), `subtotal`, `shippingAmount` (`Decimal`, default `0` — flat-rate, currently free, D-008 resolved), `couponCode` (snapshot, nullable)/`discountAmount` (default `0`), `total = subtotal + shippingAmount - discountAmount`, `currency`, `customerNote`, `internalNote` (admin-only, single overwritable field, not a log). Has many `OrderItem`, `OrderStatusHistory`, `PaymentStatusHistory`, up to one `RefundRequest`-generating history, up to one `CouponRedemption`, and an optional reverse link from a converting `Quote`.
- **`OrderItem`** — `productName`, `sku`, `unitPrice`, `quantity`, `lineTotal` are all **snapshots** taken at order-creation time, never re-derived from the live `Product` later. `productId` is a reference-only FK (`onDelete: Restrict` — a product that's ever been ordered can't be hard-deleted). `variantId` (reference-only FK, `onDelete: SetNull`) / `variantLabel` (e.g. `"Black / Medium"`, snapshot of the variant's `attributes` at order time) are the same snapshot pattern for variant purchases — nullable, since most orders have no variant.
- **`OrderStatusHistory`** — one row per `Order.status` transition: `fromStatus` (null only for the initial PENDING row), `toStatus`, `note`, `actorId` (null for the system-authored initial row).
- **`PaymentStatusHistory`** — parallel audit trail for `Order.paymentStatus`. Today it only ever gets one row per order (`NOT_PAID` at creation) since nothing changes payment status yet — it exists now so a future payment-gateway integration has an audit trail to write into from day one.

## Post-sale

- **`RefundRequest`** — order-level (not per-item), `reasonCategory` enum + free-text `reasonDetail`, `status` (`RefundRequestStatus`), `adminNote` (customer-visible), `reviewedByUserId`/`reviewedAt`. Belongs to one `Order` and one requesting `User`. **This is a request/approval workflow only** — never writes to `Order.paymentStatus` (see `BUSINESS_RULES.md`).
- **`RefundRequestStatusHistory`** — same audit shape as `OrderStatusHistory`.
- **`Quote`** — `userId` nullable (guest-submittable — contact fields are always populated inline, mirroring `Order`'s shipping snapshot), `status` (`QuoteStatus`), `currency` (snapshot from the first item's product), `adminNote`, `convertedOrderId` (unique, set only by conversion). Has many `QuoteItem`, `QuoteStatusHistory`.
- **`QuoteItem`** — `productName`/`sku` snapshotted at submission; `requestedPrice` is customer-supplied and purely informational; `quotedUnitPrice` is admin-set and is the **only** price that can ever become an `OrderItem.unitPrice` on conversion.
- **`QuoteStatusHistory`** — same audit shape, with the note that a customer's own ACCEPTED/DECLINED transition is recorded with `actorId: null` (an admin actor and a customer actor are deliberately not conflated in this field).

## Post-sale (continued) — reviews, coupons, checkout dedup

- **`Review`** — moderation-gated (`ReviewStatus`: `PENDING`/`APPROVED`/`REJECTED`, default `PENDING`); only `APPROVED` reviews are shown on the storefront or counted in a product's aggregate rating. `rating` (1-5, DB CHECK constraint + zod), `title`/`body`, `verifiedPurchase` (computed server-side at creation — does the author have a `DELIVERED` order containing this product? — never client-supplied). `@@unique([productId, userId])` — one review per user per product, DB-enforced. No separate status-history table (unlike `RefundRequest`/`Order`) — moderation isn't financial/security-critical, so a single overwritable `status` field is proportionate.
- **`Coupon`** — `code` (unique), `type` (`CouponType`: `PERCENTAGE`/`FIXED`), `value`, `minOrderAmount`/`maxDiscountAmount` (nullable), `startsAt`/`endsAt` (nullable window), `usageLimit`/`timesUsed` (global cap, `null` = unlimited), `perCustomerLimit` (nullable, enforced by counting `CouponRedemption` rows per user), `active`. Order-level, code-based discounts only — no product/category eligibility restrictions in this phase. `timesUsed` increments via the same atomic conditional-UPDATE pattern as `Inventory.quantity` (`coupon-repository.ts` `redeemAtomically`) — never read-then-write, so two concurrent checkouts can't both redeem the last unit of a limited coupon.
- **`CouponRedemption`** — one row per successful redemption, the audit trail `coupon-service.ts` counts against for `perCustomerLimit`. `orderId` is `@unique` (one coupon per order). `onDelete: Restrict` on both `couponId` and `orderId` — a coupon with existing redemptions can't be hard-deleted (deactivate instead), preserving history.
- **`CheckoutLock`** — duplicate-checkout guard for order-creation paths with no server `Cart` row to gate on (guest checkout, quote-to-order conversion). `key` is a per-checkout-attempt idempotency key the **client** generates once per checkout page load and resends on every "Place Order" click — a genuine double-click sends the same key twice; a fresh checkout (a real separate purchase) generates a new key. This is the only way to correctly distinguish "the same click, retried" from "the customer genuinely wants to buy the same items again" — a time-window-only guard (an earlier, abandoned version of this fix) cannot, since the two cases are byte-identical requests. `@@unique([userId, key])`, claimed via atomic `INSERT ... ON CONFLICT (userId, key) DO NOTHING RETURNING id` (`checkout-lock-repository.ts`) — the unique constraint's row-level lock is the actual serialization point, same principle as `Inventory.quantity`/`Coupon.timesUsed`. A caller with no client-supplied key falls back to a deterministic content hash (still catches exact resubmissions, can't distinguish two genuinely-repeated legitimate purchases). Rows are never deleted — the same key should never legitimately repeat.

## Content

- **`CMSPage`** — `slug`, `title`, `body` (a structured JSON array of typed content blocks — heading/paragraph/faqItem — **not** raw HTML or markdown-to-HTML; this is a deliberate XSS-prevention design choice, see `src/lib/validations/cms.ts` and `src/components/cms/page-renderer.tsx`, which never uses `dangerouslySetInnerHTML`), `published` (gates the public read path).
- **`Banner`** — `slot` (`HOMEPAGE_HERO` / `HOMEPAGE_PROMO`), title/subtitle/imageUrl/linkUrl/ctaText (all rendered as plain React text), `active`, `priority` (tie-breaker), optional `startsAt`/`endsAt` scheduling. An empty/inactive `Banner` table falls back to the existing static approved homepage copy — it never breaks the homepage.

## Notification

- **`Notification`** — `type` (`NotificationType`: `ORDER_STATUS_CHANGED`, `REFUND_REQUEST_UPDATED`, `QUOTE_RESPONSE`), `title`/`message` (pre-rendered snapshots, not re-derived later), `relatedEntityType`/`relatedEntityId` (optional pointer for the UI to link to), `read`/`readAt`. In-app, plus real email delivery via Resend (`src/server/services/email-notifier.ts`, D-011 resolved) — email failures are non-blocking and never fail the underlying order/refund/quote/password-reset action.

## Enums quick reference

`PurchasingMode` (BUY_ONLINE/QUOTE_ONLY/BOTH) · `Availability` (IN_STOCK/LIMITED/OUT_OF_STOCK/MADE_TO_ORDER) · `InventoryChangeReason` · `OrderStatus` (PENDING/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED) · `PaymentStatus` (NOT_PAID/PAID/REFUNDED/FAILED) · `RefundReasonCategory` · `RefundRequestStatus` (REQUESTED/UNDER_REVIEW/APPROVED/REJECTED) · `QuoteStatus` (NEW/REVIEWING/QUOTED/ACCEPTED/DECLINED/CONVERTED) · `BannerSlot` · `NotificationType` · `NotificationEntityType` · `ReviewStatus` (PENDING/APPROVED/REJECTED) · `CouponType` (PERCENTAGE/FIXED)
