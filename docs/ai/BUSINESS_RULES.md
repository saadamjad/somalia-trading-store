# Business Rules

**Read this before touching payment, orders, inventory, refunds, quotes, or authorization.** Every rule below was verified directly against the current code (`src/server/services/order-service.ts`, `inventory-service.ts`, `refund-request-service.ts`, `quote-service.ts`, `prisma/schema.prisma`, `prisma/seed.ts`) — not copied from a plan document. If you change any of this behavior, update this file in the same change.

## Payment

No payment gateway exists anywhere in this codebase (D-007, confirmed deferral, not a gap). Every order is created with `orderStatus = PENDING` and `paymentStatus = NOT_PAID`, **unconditionally, forever, in the current codebase** — `order-service.ts`'s `persistOrder`/`orderRepository.createTx` hardcode these values; no code path anywhere sets an order to `PAID` on creation or afterward. **Never simulate or fake a payment-success path.** The architecture is deliberately provider-agnostic: `PaymentStatus` (`NOT_PAID`/`PAID`/`REFUNDED`/`FAILED`) and `PaymentStatusHistory` already exist as forward-compatible scaffolding for a future gateway integration, but nothing writes to them beyond the initial `NOT_PAID` row today. Do not implement a payment gateway integration without an explicit business decision (provider selection) — see `DEFERRED_FEATURES.md`.

## Order lifecycle

The allowed order-status transition map, read directly from `order-service.ts` (`ALLOWED_STATUS_TRANSITIONS`):

```
PENDING    → CONFIRMED, CANCELLED
CONFIRMED  → PROCESSING, CANCELLED
PROCESSING → SHIPPED, CANCELLED
SHIPPED    → DELIVERED, CANCELLED
DELIVERED  → (terminal — nothing)
CANCELLED  → (terminal — nothing)
```

Rules encoded by this map: forward-only through the normal lifecycle (no skipping ahead, e.g. PENDING straight to DELIVERED; no moving backward once advanced); `CANCELLED` is reachable from any non-terminal state but is itself terminal; `DELIVERED` is terminal; a no-op transition (same status to itself) is always rejected. `assertValidTransition` throws `InvalidStatusTransitionError` (→ HTTP 400) for anything not in this map. This is enforced in exactly one place — `orderService.updateStatus` — which is also the only method in the codebase that ever changes `Order.status`.

**`orderStatus` and `paymentStatus` must never be coupled or derived from each other.** `orderService.updateStatus` takes no `paymentStatus` parameter and is structurally incapable of touching that column — it writes only to `Order.status` and `OrderStatusHistory`. This decoupling is asserted by a dedicated test in `order-service.test.ts` (Phase 9). If you ever find yourself wanting to set `paymentStatus` based on an order-status change (e.g. "mark PAID when DELIVERED"), stop — that is exactly the coupling this architecture forbids until a real payment gateway exists and a business decision is made about how payment status should actually be driven.

## Pricing integrity

Prices and totals are **always server-recalculated from the live `Product` row at order-creation time**, then snapshotted immutably onto `OrderItem` (`productName`, `sku`, `unitPrice`, `quantity`, `lineTotal`). A later product price change must never alter a historical order — and it can't, because `OrderItem` never re-reads `Product.price`. `Order.total = subtotal + shippingAmount` — `shippingAmount` is a flat $0 (free shipping, D-008 resolved) computed server-side by `order-service.ts`'s `FLAT_SHIPPING_AMOUNT`, never client-supplied. No tax/VAT is calculated (still deferred). `orderCreateSchema` (`src/lib/validations/order.ts`) has **no price, quantity, or product field at all** — the API shape itself makes client-submitted pricing impossible, not just distrusted. The order's item list is always derived from the caller's own server-side cart (`cartService.getCartForUser`), never from request body data. The one exception, by design: quote-to-order conversion (`quoteService.convertToOrder`) prices from each `QuoteItem.quotedUnitPrice` — the admin-set, locked-in quote price — not the live `Product.price`, because the entire point of a quote is a negotiated price that shouldn't drift if the catalog price changes before conversion.

## Inventory integrity

Stock can never go negative — enforced at two layers:
1. **DB-level:** a hand-added CHECK constraint on `Inventory.quantity` (Prisma's schema DSL has no native syntax for arbitrary CHECK constraints at this Prisma version, so it's added directly to the generated migration SQL).
2. **App-level:** `inventoryService.adjustStock` performs an atomic conditional UPDATE (`WHERE quantity + delta >= 0`) inside a `Prisma.$transaction` — see `inventory-repository.ts`'s `applyAdjustment`. If the conditional update affects zero rows, it signals insufficient stock and the service throws `InsufficientStockError`.

Every adjustment writes exactly one `InventoryTransaction` row, atomically with the quantity update: `actorId`, `previousQuantity`, `adjustment` (signed), `newQuantity`, `reason` (`InventoryChangeReason` enum), optional `note`. Concurrent adjustment attempts are handled safely by the same atomic conditional UPDATE — this is covered by a dedicated concurrency test (Phase 5, `inventory-service.test.ts`) that simulates simultaneous decrement attempts and confirms no overselling occurs. `adjustStock` accepts an optional already-open `tx` so callers needing atomicity across a larger operation (order creation decrementing multiple lines, all rolling back together) can pass their own transaction through instead of opening a nested one — Prisma's interactive transactions do not nest safely.

## Refunds

Request/approval workflow only — **explicitly not real financial processing** (no payment gateway exists to process a refund against). `refundRequestService.updateStatus` is the one place `RefundRequest.status` changes, and it **never touches `Order.paymentStatus`** or any other `Order` field — verified by a dedicated decoupling test in `refund-request-service.test.ts`, mirroring the Phase 9 order-status/payment-status decoupling test.

- Eligible order statuses for requesting a refund: `CONFIRMED`, `PROCESSING`, `SHIPPED`, `DELIVERED` (a `PENDING` order should be cancelled instead — nothing was collected to refund; a `CANCELLED` order was never fulfilled).
- Only one **open** (`REQUESTED`/`UNDER_REVIEW`) refund request per order at a time (`RefundRequestAlreadyOpenError`, HTTP 409).
- Status transitions: `REQUESTED → UNDER_REVIEW | APPROVED | REJECTED`; `UNDER_REVIEW → APPROVED | REJECTED`; `APPROVED`/`REJECTED` are terminal (no "reopen").
- `adminNote` is customer-visible by design — write it as an explanation for the customer, not an internal aside.

## Quotes

Guest-submittable (`POST /api/quotes` requires no session — a quote is a business inquiry, not a purchase). Admin sets pricing via `respond` (`quoteService.respond`), which requires every item on the quote to receive a `quotedUnitPrice` in the same call — a partially-priced quote is rejected (`QuoteItemMismatchError`).

- Status transitions: `NEW → REVIEWING | QUOTED | DECLINED`; `REVIEWING → QUOTED | DECLINED`; `QUOTED → ACCEPTED | DECLINED`; `ACCEPTED`/`DECLINED`/`CONVERTED` are terminal via the plain-transition map. `CONVERTED` is reachable **only** through the dedicated `convertToOrder` action, never a plain status PATCH.
- Quote-to-order conversion **locks in the quoted price** (`QuoteItem.quotedUnitPrice`), never the live product price, and **re-validates current stock** via `cartService.validateStock` at conversion time (even though the quote may have been accepted a while ago and stock may have changed since).
- Conversion **requires an associated `userId`** — a guest quote cannot self-convert, since `Order.userId` is required and there's no session to attach it to (`QuoteMissingUserForConversionError`). A guest whose quote needs converting must register/log in first.
- Conversion only succeeds from `ACCEPTED` status (`QuoteNotConvertibleError` otherwise) and is admin-triggered by design — a customer accepting a quote does not, by itself, create an order (this is a B2B-style manual sales process, not self-service checkout).
- Conversion runs inside the **same transaction** as order creation (`orderService.createOrderFromPricedItems`'s `withinTransaction` hook marks the quote `CONVERTED` atomically with the order's creation) — a converted quote and its resulting order can never disagree about whether conversion happened.

## Coupons/discounts

One coupon per order (`@@unique([orderId])` on `CouponRedemption`). A discount is always server-computed from the live `Coupon` row at order-creation time and snapshotted onto `Order.discountAmount`/`Order.couponCode` — the client only ever sends a code, never an amount (`orderCreateSchema`/`guestOrderCreateSchema` have no discount field). `Order.total = subtotal + shippingAmount - discountAmount`. Validation (`coupon-service.ts`) checks: active flag, start/end date window, `minOrderAmount`, global `usageLimit`, and `perCustomerLimit` (requires a session). The global usage limit is enforced by an atomic conditional `UPDATE ... WHERE usageLimit IS NULL OR timesUsed < usageLimit` (`coupon-repository.ts` `redeemAtomically`) — the same pattern as `Inventory.quantity` — inside the SAME transaction as order creation and inventory decrement, so a coupon redemption and its order are created atomically or not at all; if the coupon's last unit is claimed by a concurrent checkout, the whole order rolls back (never a half-applied discount). A coupon with existing redemptions can't be hard-deleted (`CouponRedemption.couponId` is `onDelete: Restrict`) — deactivation (`Coupon.active = false`) is the only "remove" action.

## Product variants (size/color)

Optional per product — a product with zero `ProductVariant` rows behaves exactly as it did before this feature existed (single SKU, `Inventory` keyed by `productId`). Variant stock/cart/order lines are a deliberately PARALLEL set of models (`ProductVariant`, `VariantInventory`, `VariantInventoryTransaction`) rather than a nullable-variantId retrofit of `Inventory`/`CartItem`/`OrderItem` — see `ProductVariant`'s schema comment for the full rationale (mainly: zero regression risk to the existing, tested, single-SKU catalog and its atomic no-oversell guarantee).

- **Pricing:** a variant's `price` is a nullable override — `null` falls back to the parent `Product.price` at order-creation time. Always server-computed, never client-supplied (same principle as plain `OrderItem.unitPrice`).
- **Stock:** `VariantInventory` mirrors `Inventory` exactly, including the same atomic conditional-UPDATE no-oversell guarantee (`variantInventoryRepository.applyAdjustment`, tested with the same concurrency-race pattern as the original).
- **Cart:** a `CartItem` line is uniquely identified by `(productId, variantId)` — two different variants of the same product are two distinct lines, enforced by a pair of hand-added PARTIAL unique indexes (one for `variantId IS NULL`, preserving the original one-row-per-product guarantee unchanged; one for `variantId IS NOT NULL`).
- **Orders:** `OrderItem.variantId`/`variantLabel` are historical snapshots — `variantLabel` (e.g. `"Black / M"`, rendered from the variant's `attributes` at order-creation time) survives even if the variant is later edited or deleted (`onDelete: SetNull` on `variantId`).
- **Deletion:** a variant with existing `OrderItem`s can't be hard-deleted (`productVariantService.delete` throws `VariantHasOrdersError`) — deactivate (`active: false`) instead, same pattern as coupons.

## Product reviews

One review per user per product (`@@unique([productId, userId])` on `Review`), enforced at the DB layer. Every review starts `PENDING`; only `APPROVED` reviews are ever shown on the storefront or counted in a product's aggregate rating/JSON-LD `aggregateRating` — a `PENDING`/`REJECTED` review is invisible to everyone except the review's own author and admins with `reviews.view`. `verifiedPurchase` is computed server-side at creation time (`orderRepository.hasDeliveredOrderWithProduct`) — true only if the reviewer has a `DELIVERED` order containing the product — and is never accepted from the request body; the API schema (`reviewCreateSchema`) has no `verifiedPurchase` or `status` field at all, same "the shape itself makes it impossible" pattern as `orderCreateSchema`. Moderation (`reviews.manage`) is a single overwritable status field, not a terminal state machine — an admin can always re-moderate (e.g. un-approve a review later), unlike Order/RefundRequest status.

## Customer data isolation

Every customer-owned resource — orders, addresses, cart, wishlist, refund requests, quotes (when they have a `userId`), notifications — is scoped by the **session-verified** user id at the query level (e.g. `orderRepository.findByIdForUser(id, userId)`), never a client-supplied id. **Ownership violations return 404, not 403** — e.g. `OrderNotFoundError`/`OrderNotFoundForRefundError`/`RefundRequestNotFoundError`/`QuoteNotFoundError` are thrown identically whether the resource genuinely doesn't exist or belongs to someone else, so a 404 never confirms to an unauthorized caller that a given order/address/refund/quote id is real. `src/server/lib/api-errors.ts`'s `toErrorResponse` maps all of these to HTTP 404. This pattern is explicitly IDOR-tested (Phase 6/9 acceptance criteria; also exercised by the E2E suite).

## Authorization

Server-side only, via `requireSession()` and `requirePermission(key)` (`src/server/auth/session.ts`, `permissions.ts`) — **never trust a client-side role flag.** `requirePermission` re-derives the role's permission set live from the database (`Role → RolePermission → Permission`) on every call; it does not trust anything embedded in the JWT beyond which role name the session belongs to.

**Actual seeded roles** (`prisma/seed.ts`, `seedAuth()`), verified directly in code — read this before assuming a richer role model exists:

- **`customer`** — no permissions granted at all. Customers only ever access their own data, enforced entirely by ownership checks (`userId === session.userId`), never by a permission grant.
- **`staff`** — operational permissions only (products, categories, inventory, orders, CMS). Explicitly excluded from anything that surfaces financial figures or admin-account management: no `dashboard.view`, `reports.view`, `refunds.*`, `quotes.*`, or `admin_users.*` (see `staffExcludedKeys` in `prisma/seed.ts`).
- **`admin`** — every permission except `admin_users.*` (cannot create, update, deactivate, or reset the password of another admin account). Unlike `staff`, sees financial data: dashboard, reports, refunds, quotes.
- **`super_admin`** — every permission that exists, including `admin_users.*`, granted automatically (the seed loops over all seeded permissions and grants each to `super_admin`), so any future migration/seed adding a new permission key automatically flows through to `super_admin` too.

Human-readable labels and short descriptions for these three admin-selectable roles (`staff`/`admin`/`super_admin`) are centralized in `src/config/permission-labels.ts` (`roleLabel`/`roleDescription`) and surfaced live in the admin user create/edit form (`src/components/admin/admin-user-form.tsx`) — keep those two functions in sync with `seedAuth()` if a role's actual permission set ever changes.

**The README and `docs/DECISIONS.md` describe a richer, still-aspirational role model** (Product Manager, Inventory Manager, Order Manager, Customer Support, Finance, Content Manager) as the original target design — those additional granular roles are **not** seeded or selectable anywhere in the app today; only `customer`/`staff`/`admin`/`super_admin` exist. See `KNOWN_LIMITATIONS.md`.

Example seeded permission keys (`prisma/seed.ts` `permissionKeys`): `products.view`, `products.create`, `products.update`, `products.delete`, `categories.create`, `categories.update`, `categories.delete`, `inventory.view`, `inventory.update`, `orders.view`, `orders.update`, `customers.view`, `customers.update`, `refunds.view`, `refunds.manage`, `quotes.view`, `quotes.manage`, `cms.view`, `cms.manage`, `reports.view`.
