# Deferred Features

These are **confirmed, documented deferrals** — not forgotten work, not broken features, not TODOs. Each depends on a business decision that hasn't been made yet (a provider choice, a currency confirmation, a budget/scope decision). **A future agent must NOT interpret any of these as a gap to silently fill in.** Implementing one of these without the underlying decision being made first will very likely produce something that has to be re-done once the real decision is made (wrong provider's SDK, wrong currency baked into UI copy, etc.) — flag it back to the user/client instead and point them at the relevant decision record.

## Payment gateway

**Decision record:** `docs/DECISIONS.md` D-007.
No payment gateway is selected or implemented. The order/checkout architecture is deliberately provider-agnostic — `PaymentStatus`/`PaymentStatusHistory` exist as scaffolding, but every order is `PENDING`/`NOT_PAID` unconditionally (see `docs/ai/BUSINESS_RULES.md`, Payment section). **Do not implement Stripe/PayPal/a mobile-money integration/etc. without an explicit client decision on which provider to use.** When the decision is made, the integration point is the checkout flow plus a new "payment update" write path to `Order.paymentStatus` — it should not require rewriting cart/checkout/orders/customers/admin/inventory.

## Shipping calculation — RESOLVED (flat $0)

**Decision record:** `docs/DECISIONS.md` D-008 (shipping half resolved; tax half still deferred — see below).
Client confirmed a flat shipping fee of **$0 (free shipping)** rather than a carrier/zone-based model. `Order.shippingAmount` is a real field now, computed by `FLAT_SHIPPING_AMOUNT` in `src/server/services/order-service.ts` and included in every order's `total`. No courier integration or delivery-zone logic exists — if the business later wants zone/carrier-based rates, that's a new (larger) decision, not implied by this resolution.

## Tax / VAT

**Decision record:** `docs/DECISIONS.md` D-008 (same entry as shipping).
No tax/VAT calculation exists anywhere. Same "kept a field slot open, didn't build the logic" pattern as shipping — a `taxAmount` field can be added later. Do not invent a tax rate or jurisdiction model without a client decision.

## Real email delivery — RESOLVED

**Decision records:** `docs/DECISIONS.md` D-010, D-011 (both now marked resolved).
Resend is now wired in as the real provider behind `src/server/services/email-notifier.ts`'s `send()` (requires `RESEND_API_KEY`/`FROM_EMAIL` env vars — see `.env.example`). Password resets (`authService.requestPasswordReset`) and order/refund/quote notifications all deliver real email now. Still open, separately: whether an email-verification-required gate should block login/checkout for unverified accounts (D-010's remaining open item) — that is a product-policy decision, not a delivery-mechanism one, and is unaffected by this resolution.

## Somali (i18n)

Not implemented — English only (`<html lang="en">`), no translation library, no message files, all copy hardcoded directly in JSX. This was flagged in the original Phase 0 audit (`docs/PROJECT_AUDIT.md` §11) as requiring a full retrofit (extracting every user-facing string into translation keys before Somali support can be added) and was never scheduled as a dedicated phase across the 18-phase build. This is a scoping/budget decision, not a technical blocker — if asked to add Somali support, expect it to touch nearly every component with user-facing text, and confirm the client wants to commit to that scope before starting rather than doing a partial retrofit.

## Object storage for product images

Admin-uploaded product/category/banner images now go through real file upload to Vercel Blob storage (`POST /api/admin/upload` — see `API.md`), not a URL-string field or the local `/public/images/...` tree. Static marketing/story imagery (About page, homepage Our Story section, gallery) still lives in `/public/images/...` or is occasionally hotlinked from Unsplash — that part of this deferral (a dedicated CDN for *static* site imagery, as opposed to admin-uploaded content) is still accurate. Revisit if static-asset volume grows enough to matter for build size/CDN caching.

## Operating currency — RESOLVED (USD)

**Decision record:** `docs/DECISIONS.md` D-006 — resolved 2026-08-30.
Client confirmed **USD** as the real operating currency, not a placeholder. `currency` remains a plain string field (`Product.currency`, `Order.currency`, `Quote.currency`) rather than a closed TS literal, so no code change was needed for this confirmation — and none would be needed if the business changes currency in the future either.
