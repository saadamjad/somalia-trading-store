# Database Map

This is a summary of every Prisma model, grouped by domain. **`prisma/schema.prisma` is the authoritative source — this is a map, not a replacement.** Every model in the schema has its own detailed comment explaining the design rationale; read the schema directly when you need the "why", not just the "what". Field lists below are non-exhaustive (timestamps, ids, and obvious FKs are usually omitted).

## Identity

- **`User`** — email, bcrypt `passwordHash`, name, phone, `emailVerified` (nullable — no verification gate is enforced yet, D-010). Belongs to one `Role`. Has one `Cart`, one `Wishlist` (both created lazily on first use, not at registration), many `Address`, `Order`, `Quote` (nullable — guest quotes have no `User`), `RefundRequest` (two relations: made vs. reviewed), `Notification`.
- **`Role`** — a name (`customer`, `super_admin` — see `BUSINESS_RULES.md` for what's actually seeded vs. what's described elsewhere). Has many `RolePermission`.
- **`Permission`** — a unique `key` string, `"<resource>.<action>"` convention (e.g. `products.create`).
- **`RolePermission`** — join table, `@@id([roleId, permissionId])`.
- **`PasswordResetToken`** — token, `expiresAt`, `usedAt`. Belongs to one `User`. No real email delivery sends this — it's logged to the server console (D-010).

## Catalog

- **`Category`** — slug, name, description, hero/banner image fields, `accentColor`. Self-referential (`parentId`/`children`) for nesting, though the seeded data is flat. Has many `Product`.
- **`Product`** — slug, sku (unique, nullable), name, description, `categoryId`, `subcategory` (free-text facet, not its own table), `price`/`compareAtPrice` (`Decimal(12,2)`), `currency` (defaults `"USD"`, D-006 open), `priceUnit` (e.g. "sqm"), `images` (string array), `specifications` (JSON), `tags`, `purchasingMode` (`BUY_ONLINE`/`QUOTE_ONLY`/`BOTH`), `availability` enum, `featured`. Has one `Inventory`, many `InventoryTransaction`, `CartItem`, `WishlistItem`, `OrderItem`, `QuoteItem`.

## Inventory

- **`Inventory`** — 1:1 with `Product`. `quantity` (must never go negative — enforced by a hand-added DB CHECK constraint in the migration SQL *and* an atomic conditional UPDATE at the app layer), `lowStockThreshold` (default 10).
- **`InventoryTransaction`** — full audit log: `previousQuantity`, `adjustment` (signed), `newQuantity`, `reason` (`InventoryChangeReason` enum: `MANUAL_ADJUSTMENT`, `RESTOCK`, `CORRECTION`, `ORDER_PLACED`, `ORDER_CANCELLED`), optional `note`, `actorId` (required — every adjustment has an actor). Never mutated or deleted; one row per adjustment.

## Commerce (pre-order)

- **`Cart`** / **`CartItem`** — 1:1 `Cart` per `User`, lazily created. `CartItem` has `quantity` only (no price snapshot — price is always read live from `Product`). `@@unique([cartId, productId])` enforces one row per product; adding is always an upsert against this constraint.
- **`Wishlist`** / **`WishlistItem`** — same shape/rationale as Cart, no quantity (a product either is or isn't on the wishlist). `@@unique([wishlistId, productId])` is the DB-level duplicate guard.
- **`Address`** — `recipientName`, `phone`, `line1`/`line2`, `city`, `region`, `postalCode` (optional — Somalia addressing doesn't always use one), `country`, `isDefault`. Belongs to one `User`. Every read/write path scopes by session `userId`, never a client-supplied one.

## Orders

- **`Order`** — `orderNumber` (unique, generated, retried on collision), `status` (`OrderStatus`), `paymentStatus` (`PaymentStatus`, kept structurally independent — see `BUSINESS_RULES.md`), shipping fields copied inline (never a live `Address` FK, so editing/deleting the source address later can't alter a past order's "shipped to"), `subtotal`/`total` (`Decimal`, equal today since no tax/shipping exist yet, D-008), `currency`, `customerNote`, `internalNote` (admin-only, single overwritable field, not a log). Has many `OrderItem`, `OrderStatusHistory`, `PaymentStatusHistory`, up to one `RefundRequest`-generating history, and an optional reverse link from a converting `Quote`.
- **`OrderItem`** — `productName`, `sku`, `unitPrice`, `quantity`, `lineTotal` are all **snapshots** taken at order-creation time, never re-derived from the live `Product` later. `productId` is a reference-only FK (`onDelete: Restrict` — a product that's ever been ordered can't be hard-deleted).
- **`OrderStatusHistory`** — one row per `Order.status` transition: `fromStatus` (null only for the initial PENDING row), `toStatus`, `note`, `actorId` (null for the system-authored initial row).
- **`PaymentStatusHistory`** — parallel audit trail for `Order.paymentStatus`. Today it only ever gets one row per order (`NOT_PAID` at creation) since nothing changes payment status yet — it exists now so a future payment-gateway integration has an audit trail to write into from day one.

## Post-sale

- **`RefundRequest`** — order-level (not per-item), `reasonCategory` enum + free-text `reasonDetail`, `status` (`RefundRequestStatus`), `adminNote` (customer-visible), `reviewedByUserId`/`reviewedAt`. Belongs to one `Order` and one requesting `User`. **This is a request/approval workflow only** — never writes to `Order.paymentStatus` (see `BUSINESS_RULES.md`).
- **`RefundRequestStatusHistory`** — same audit shape as `OrderStatusHistory`.
- **`Quote`** — `userId` nullable (guest-submittable — contact fields are always populated inline, mirroring `Order`'s shipping snapshot), `status` (`QuoteStatus`), `currency` (snapshot from the first item's product), `adminNote`, `convertedOrderId` (unique, set only by conversion). Has many `QuoteItem`, `QuoteStatusHistory`.
- **`QuoteItem`** — `productName`/`sku` snapshotted at submission; `requestedPrice` is customer-supplied and purely informational; `quotedUnitPrice` is admin-set and is the **only** price that can ever become an `OrderItem.unitPrice` on conversion.
- **`QuoteStatusHistory`** — same audit shape, with the note that a customer's own ACCEPTED/DECLINED transition is recorded with `actorId: null` (an admin actor and a customer actor are deliberately not conflated in this field).

## Content

- **`CMSPage`** — `slug`, `title`, `body` (a structured JSON array of typed content blocks — heading/paragraph/faqItem — **not** raw HTML or markdown-to-HTML; this is a deliberate XSS-prevention design choice, see `src/lib/validations/cms.ts` and `src/components/cms/page-renderer.tsx`, which never uses `dangerouslySetInnerHTML`), `published` (gates the public read path).
- **`Banner`** — `slot` (`HOMEPAGE_HERO` / `HOMEPAGE_PROMO`), title/subtitle/imageUrl/linkUrl/ctaText (all rendered as plain React text), `active`, `priority` (tie-breaker), optional `startsAt`/`endsAt` scheduling. An empty/inactive `Banner` table falls back to the existing static approved homepage copy — it never breaks the homepage.

## Notification

- **`Notification`** — `type` (`NotificationType`: `ORDER_STATUS_CHANGED`, `REFUND_REQUEST_UPDATED`, `QUOTE_RESPONSE`), `title`/`message` (pre-rendered snapshots, not re-derived later), `relatedEntityType`/`relatedEntityId` (optional pointer for the UI to link to), `read`/`readAt`. In-app only — real email delivery does not exist anywhere in this codebase; `src/server/services/email-notifier.ts` only logs (D-011).

## Enums quick reference

`PurchasingMode` (BUY_ONLINE/QUOTE_ONLY/BOTH) · `Availability` (IN_STOCK/LIMITED/OUT_OF_STOCK/MADE_TO_ORDER) · `InventoryChangeReason` · `OrderStatus` (PENDING/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED) · `PaymentStatus` (NOT_PAID/PAID/REFUNDED/FAILED) · `RefundReasonCategory` · `RefundRequestStatus` (REQUESTED/UNDER_REVIEW/APPROVED/REJECTED) · `QuoteStatus` (NEW/REVIEWING/QUOTED/ACCEPTED/DECLINED/CONVERTED) · `BannerSlot` · `NotificationType` · `NotificationEntityType`
