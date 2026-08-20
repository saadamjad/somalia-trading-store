# Decisions Log — Somalia Trading Store

Each entry records a decision, its classification (Business / Technical / Implementation Detail), the decision itself, rationale, and status. New entries append to the bottom; do not edit history — supersede with a new entry and cross-reference if a decision changes.

---

## D-001: Backend Architecture

**Classification:** Technical Decision
**Status:** Confirmed
**Date:** 2026-08-19

**Decision:** Backend implemented as Next.js API routes (App Router route handlers) within the same application, not a separate service. Business logic isolated in `src/server/services/`, data access in `src/server/repositories/` (Controller → Service → Repository pattern per spec §29).

**Rationale:**
- The client/server boundary is enforced by the Next.js build system itself — server-only code (route handlers, `src/server/*`, non-`"use client"` components) is never bundled into the browser JavaScript. A separate backend service does not close any security gap that exists here, because none exists — server code is equally inaccessible to the client either way.
- One codebase, one deploy pipeline, one language (TypeScript) — lower operational overhead at this project's current stage (no traffic yet, small team).
- Keeping the services/repositories layer strictly isolated from route handlers means it can be extracted into a standalone service later, if independent scaling is ever genuinely needed, without a rewrite.
- A split backend was considered and rejected for now — it adds a second deployment/ops surface without a corresponding benefit at current scale, and nothing in the spec requires independent scaling of API vs. frontend at this stage.

**Revisit if:** traffic or team size grows to the point where independent scaling/deployment of the API is genuinely needed — at that point, the isolated `src/server/` layer can be lifted into its own service.

---

## D-002: Database

**Classification:** Technical Decision
**Status:** Confirmed
**Date:** 2026-08-19

**Decision:** PostgreSQL, hosted as a managed service separate from the application deployment (e.g. Neon, Supabase, or RDS), reachable only via a private connection string in environment variables — never exposed to the browser.

**Rationale:** Spec §27 prefers relational unless there's a strong reason otherwise; there isn't one here. E-commerce data (orders, order items, inventory transactions, roles/permissions, foreign-key relationships) fits a relational model well and needs real transactional integrity (spec §28, §8).

---

## D-003: ORM

**Classification:** Technical Decision
**Status:** Confirmed
**Date:** 2026-08-19

**Decision:** Prisma.

**Rationale:** Type-safe queries matching the existing TypeScript-strict codebase, straightforward/reviewable migrations, integrates cleanly with Next.js route handlers and with Auth.js's official Prisma adapter.

---

## D-004: Authentication

**Classification:** Technical Decision
**Status:** Confirmed
**Date:** 2026-08-19

**Decision:** Self-rolled authentication via Auth.js (NextAuth), credentials provider, bcrypt password hashing, backed by Prisma/Postgres.

**Rationale:**
- The spec requires a custom, granular roles/permissions model (Customer, Super Admin, Admin, Product Manager, Inventory Manager, Order Manager, Customer Support, Finance, Content Manager — spec §25) with fine-grained permissions (`products.create`, `inventory.update`, etc.).
- A managed auth provider (Clerk/Auth0/Supabase Auth) would still require building and syncing this same Roles/Permissions schema back into the app's own database, adding a third-party dependency, recurring cost, and an extra system to keep consistent — without removing any of the schema work.
- Auth.js + Prisma keeps identity and authorization in one database, one source of truth, under full control.

**Revisit if:** the client later wants social login (Google/Facebook) at scale, or offloading auth infrastructure becomes a stronger priority than schema control — Auth.js supports adding OAuth providers alongside credentials without a rewrite.

---

## D-005: Deployment Model

**Classification:** Technical Decision
**Status:** Confirmed
**Date:** 2026-08-19

**Decision:** Single Next.js application deployed as one unit (e.g. Vercel or any Node-capable host). Build process automatically splits the client bundle (served to browsers) from the server runtime (route handlers, server components) — this split is a framework guarantee, not something hand-rolled. Database and object storage (for product images, once catalog scales) are separate managed services, not part of the app deployment.

**Rationale:** See D-001. Matches "keep it simple, scale what actually needs scaling" per spec §33 (no unnecessary infrastructure).

---

## D-006: Currency — OPEN BUSINESS DECISION

**Classification:** Business Decision
**Status:** ⚠️ UNRESOLVED — pending client confirmation
**Date:** 2026-08-19

**Context:** The current demo hardcodes `currency: "USD"` as a TypeScript literal type across the product/pricing types. Per spec §34: "Do NOT hard-code currency throughout the application. Do not invent the client's currency."

**Decision so far:** The currency will be made a **configurable value** (e.g. a settings/config entry, not a closed TS literal union), defaulting to USD for continued development purposes only. The actual currency the business will transact in (USD, Somali Shilling, or another) has **not been confirmed** and must not be assumed.

**Action required:** Client must confirm the operating currency before Phase 8 (Checkout & Order Placement) can be considered functionally complete for real use. Until confirmed, all pricing/checkout work proceeds with USD as a placeholder default, with the underlying schema built to support changing it without a rewrite.

---

## D-007: Payment Gateway — OUT OF SCOPE (Confirmed Deferral)

**Classification:** Business Decision
**Status:** Deferred, not a gap — explicitly out of scope for the current phase per client instruction
**Date:** 2026-08-19

**Decision:** No payment gateway is selected or implemented in this phase. The order/checkout architecture must remain provider-agnostic: `Checkout → Payment Request → Payment Provider → Verification → Payment Success → Update Payment Status → Finalize Order → Confirmation`, with the middle steps unimplemented until the client selects a provider. Orders are fully creatable and manageable with `paymentStatus = NOT_PAID` and `orderStatus = PENDING` (spec §4-5, §8).

**Action required:** Client to confirm a payment gateway in a future phase; integration will be added as a separate module without rewriting cart/checkout/orders/customers/admin/inventory (spec §8).

---

## D-008: Tax and Shipping — OUT OF SCOPE (Confirmed Deferral)

**Classification:** Business Decision
**Status:** Deferred per explicit client instruction (spec §35-36)
**Date:** 2026-08-19

**Decision:** No tax calculation, VAT, shipping providers, courier integration, delivery zones, or shipping-charge calculation is implemented. Schema and checkout flow are designed to allow both to be introduced later without breaking existing order/checkout logic (e.g. order totals structured to allow adding `taxAmount`/`shippingAmount` fields later rather than baking an assumption of $0 into business logic permanently).

---

## D-009: CI/CD and Production Infrastructure — OUT OF SCOPE (Confirmed Deferral)

**Classification:** Business Decision
**Status:** Deferred per explicit client instruction (spec §37-38)
**Date:** 2026-08-19

**Decision:** No CI/CD pipelines, no staging/production infrastructure provisioning in this phase. The project remains CI/CD-ready: lint, typecheck, test, and build scripts exist and pass, so a pipeline can be wired up later without code changes. `.env.example` documents required environment variables for dev/staging/production without committing real secrets.

---

## D-010: Email Verification / Email Sending — DEFERRED (Blocked on Provider Decision)

**Classification:** Technical Decision
**Status:** Deferred — blocked pending an email provider decision
**Date:** 2026-08-19

**Decision:** Phase 3 adds the `emailVerified` field to the `User` model and a full password-reset token flow (`PasswordResetToken`), but does not send real email. There is no SMTP/email-provider integration in this phase. In the interim, the password-reset link is written to the server console (`src/server/services/auth-service.ts`, `requestPasswordReset`) purely so the flow is exercisable in local development — this is explicitly not sufficient for production use, and no email-verification-required gate is enforced on login (accounts work immediately after registration, with `emailVerified` left `null`).

**Rationale:**
- Sending real email requires choosing a provider (e.g. Resend, SES, Postmark, SendGrid) and provisioning credentials/domain verification (SPF/DKIM) — a business/infrastructure decision, not something to assume.
- Building the schema and token flow now (rather than deferring the whole feature) means no future migration or rework is needed once a provider is chosen — only the delivery mechanism inside `requestPasswordReset` (and a new "send verification email" call after registration) needs to be swapped in.

**Action required:** Client/team to choose an email provider. Once chosen: (1) wire real delivery into `authService.requestPasswordReset`, (2) add an email-verification-send step to `authService.register` and a `/api/auth/verify-email` (or equivalent) confirmation route that sets `User.emailVerified`, (3) decide whether unverified accounts should be restricted (e.g. blocked from checkout) — not decided yet.

---

## D-011: Notification Delivery Channel — In-App Real, Email Stubbed (Blocked on Provider Decision)

**Classification:** Technical Decision
**Status:** Deferred (email channel only) — blocked pending the same email provider decision as D-010
**Date:** 2026-08-20

**Context:** Phase 15 (Notifications) requires notifying customers of order status changes, refund request approvals/rejections, and quote responses. Per docs/IMPLEMENTATION_PLAN.md Phase 15: "Depends on an email provider decision if email is required — flag as a technical decision to resolve at phase start if not already settled." No email provider has been chosen — this is the same open business decision as D-010, not a new one, and this entry exists only because Phase 15's scope (notification delivery generally) is broader than D-010's (password-reset/verification email specifically), not because the underlying blocker differs.

**Decision:** In-app notifications (the `Notification` model, `/api/notifications`, the header unread-count indicator) are built as the real, fully working feature this phase delivers — no stubbing, no deferral. Email is implemented only as an interface: `src/server/services/email-notifier.ts` exports `emailNotifier.send(to, subject, body)`, which logs `[email-notifier] would send email to X: subject Y` to the server console and does not contact any real email provider or SMTP server. It is called from the same three trigger points as the in-app notification (`order-service.ts` `updateStatus`, `refund-request-service.ts` `updateStatus`, `quote-service.ts` `respond`) so both "channels" exist in the code path, exactly mirroring the console-log pattern D-010 established for password-reset links in `authService.requestPasswordReset`.

**Rationale:**
- Consistency: reusing D-010's exact interim pattern (log instead of send) rather than inventing a second convention for the same underlying blocker.
- The architecture is ready to plug in a real provider later — `notificationService.notify()` is the single call site that invokes `emailNotifier.send`, so swapping the stub's body for a real Resend/SES/Postmark/SendGrid call requires no changes to order-service.ts, refund-request-service.ts, or quote-service.ts.
- In-app notifications don't have this blocker at all (no third-party dependency), so there's no reason to defer that half of the feature — only the email half is genuinely blocked.

**Action required:** Same as D-010 — client/team to choose an email provider. Once chosen, only `emailNotifier.send`'s implementation needs to change; every call site stays the same.

---

## D-012: npm audit findings (Phase 16) — no safe fix available, documented as accepted risk

**Classification:** Technical Decision
**Status:** Confirmed — re-audit at next `prisma`/`exceljs` release, not forced now
**Date:** 2026-08-20

**Context:** Phase 16 security hardening ran `npm audit` (5 findings: 3 high, 2 moderate, all transitive). Per the phase instructions, only safe/targeted fixes should be applied — no blind `npm audit fix --force` that could pull in breaking majors.

**Finding 1 — `deepmerge-ts` stack exhaustion (GHSA-ggr8-5vv4-36mx, high) via `@prisma/config` → `prisma`:**
`prisma@7.9.1` (the current, latest-stable 7.x release — verified via `npm view prisma versions`, nothing newer exists between 7.9.1 and the unreleased `8.0.0-rc.*` prereleases) depends on `@prisma/config@7.9.1`, which pins `deepmerge-ts@7.1.5` (vulnerable range `<8.0.0`). npm's only `fixAvailable` path is downgrading to `prisma@6.12.0`, a major *downgrade* from the 7.x already in use throughout `prisma/schema.prisma`, `src/server/lib/prisma.ts`, and every repository — not applied, since it would be a breaking regression, not a fix. The vulnerable code path (stack exhaustion merging deeply recursive object graphs) is exercised by `@prisma/config`'s own config-merging logic at CLI/build time (`prisma migrate`, `prisma generate`), not by the Prisma Client query path this app's request handlers actually call at runtime — so the practical exposure is a local/CI tooling DoS, not a production request-path vulnerability.
**Decision:** Not fixed now. Revisit when `prisma` ships a stable 8.x (or a 7.x patch bumping `deepmerge-ts`) — re-run `npm audit` at that point.

**Finding 2 — `uuid` missing buffer bounds check (GHSA-w5hq-g745-h8pq, moderate) via `exceljs`:**
`exceljs@4.4.0` (latest stable — verified via `npm view exceljs versions`) depends on `uuid@^8.3.0` (resolves to `8.3.2`, vulnerable range `<11.1.1`). The advisory affects `uuid`'s `v3`/`v5`/`v6` functions **only when called with an explicit output buffer argument**. Checked `exceljs`'s actual usage (`grep -rn "require('uuid')" node_modules/exceljs/lib`): the only call site is `node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`, which calls `uuidv4()` (the `v4` function, not `v3`/`v5`/`v6`) with no buffer argument — the vulnerable code path is never reached by this dependency's actual usage in this app (used for XLSX report export, `src/server/lib/export/xlsx.ts`). npm's only `fixAvailable` path is downgrading `exceljs` to `3.4.0`, a major downgrade with breaking API differences — not applied.
**Decision:** Not fixed (no safe upstream fix exists), and verified non-exploitable given actual usage. Revisit when `exceljs` ships a release depending on `uuid@>=11.1.1`.

**Rationale for not using `npm audit fix --force` or manual `overrides`:** Forcing `prisma` to `6.x` would break every Prisma 7 API surface used across the codebase (a 15-phase regression risk far exceeding the actual DoS exposure of a CLI-only dependency). Forcing an `overrides` entry to bump `uuid` to `11.x` under `exceljs` risks an undocumented API mismatch (uuid v11 changed its packaging/exports) for a code path already confirmed unreachable. Both were rejected as disproportionate to the actual risk, per spec §33 "keep it simple, no unnecessary/speculative changes."
