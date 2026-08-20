# Deferred Features

These are **confirmed, documented deferrals** — not forgotten work, not broken features, not TODOs. Each depends on a business decision that hasn't been made yet (a provider choice, a currency confirmation, a budget/scope decision). **A future agent must NOT interpret any of these as a gap to silently fill in.** Implementing one of these without the underlying decision being made first will very likely produce something that has to be re-done once the real decision is made (wrong provider's SDK, wrong currency baked into UI copy, etc.) — flag it back to the user/client instead and point them at the relevant decision record.

## Payment gateway

**Decision record:** `docs/DECISIONS.md` D-007.
No payment gateway is selected or implemented. The order/checkout architecture is deliberately provider-agnostic — `PaymentStatus`/`PaymentStatusHistory` exist as scaffolding, but every order is `PENDING`/`NOT_PAID` unconditionally (see `docs/ai/BUSINESS_RULES.md`, Payment section). **Do not implement Stripe/PayPal/a mobile-money integration/etc. without an explicit client decision on which provider to use.** When the decision is made, the integration point is the checkout flow plus a new "payment update" write path to `Order.paymentStatus` — it should not require rewriting cart/checkout/orders/customers/admin/inventory.

## Shipping calculation

**Decision record:** `docs/DECISIONS.md` D-008.
No shipping-charge calculation, courier integration, or delivery-zone logic exists. `Order.subtotal`/`Order.total` are equal today by construction, specifically so a `shippingAmount` field can be added later without a breaking schema change. Do not hardcode a shipping fee or invent a delivery-zone model without a client decision on carriers/zones/rates.

## Tax / VAT

**Decision record:** `docs/DECISIONS.md` D-008 (same entry as shipping).
No tax/VAT calculation exists anywhere. Same "kept a field slot open, didn't build the logic" pattern as shipping — a `taxAmount` field can be added later. Do not invent a tax rate or jurisdiction model without a client decision.

## Real email delivery

**Decision records:** `docs/DECISIONS.md` D-010 (password reset / verification), D-011 (order/refund/quote notifications).
No SMTP/email-provider integration exists. Password-reset links are logged to the server console (`authService.requestPasswordReset`); order/refund/quote notification emails are logged via `src/server/services/email-notifier.ts`'s `send()` stub (`[email-notifier] would send email to X: subject Y`). Both interim behaviors are intentional development-time stand-ins, not bugs. **The integration point is a single function** — `emailNotifier.send`'s implementation — so wiring in a real provider (Resend, SES, Postmark, SendGrid) requires no changes to any call site (`order-service.ts`, `refund-request-service.ts`, `quote-service.ts`, `auth-service.ts`). Do not pick a provider and wire it in without a client decision — this also unblocks the email-verification-required gate on login, which is a separate open decision (D-010: "decide whether unverified accounts should be restricted — not decided yet").

## Somali (i18n)

Not implemented — English only (`<html lang="en">`), no translation library, no message files, all copy hardcoded directly in JSX. This was flagged in the original Phase 0 audit (`docs/PROJECT_AUDIT.md` §11) as requiring a full retrofit (extracting every user-facing string into translation keys before Somali support can be added) and was never scheduled as a dedicated phase across the 18-phase build. This is a scoping/budget decision, not a technical blocker — if asked to add Somali support, expect it to touch nearly every component with user-facing text, and confirm the client wants to commit to that scope before starting rather than doing a partial retrofit.

## Object storage for product images

Product images are currently served from the repo (`/public/images/...`) or hotlinked from Unsplash, not a dedicated object storage/CDN. Flagged in Phase 17 as deferred, not yet warranted at the current catalog size (~9 products). Revisit if the catalog grows significantly or image-upload-by-admins becomes a real requirement (currently, admin product images are set via URL string, not file upload).

## Operating currency

**Decision record:** `docs/DECISIONS.md` D-006 — still an open business decision, not deferred-and-forgotten.
`currency` defaults to `"USD"` throughout (`Product.currency`, `Order.currency`, `Quote.currency`) as a **development placeholder only** — the actual currency the business will transact in (USD, Somali Shilling, or another) has not been confirmed by the client. The schema stores currency as a plain string field specifically so changing it doesn't require a schema migration, but every piece of UI copy, formatting logic, and seed data currently assumes USD. Do not assume USD is final, and do not hardcode a different currency either — surface this as still needing a client decision if it comes up.
