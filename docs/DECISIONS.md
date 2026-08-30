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

## D-006: Currency — RESOLVED (USD confirmed)

**Classification:** Business Decision
**Status:** Resolved — USD confirmed as the operating currency
**Date:** 2026-08-19 (opened), 2026-08-30 (resolved)

**Context:** The current demo hardcodes `currency: "USD"` as a TypeScript literal type across the product/pricing types. Per spec §34: "Do NOT hard-code currency throughout the application. Do not invent the client's currency."

**Resolution:** Client confirmed USD as the real operating currency (not a placeholder) on 2026-08-30. No code change was required — `currency` was already a configurable `String` field (`Product.currency`, `Order.currency`, `Quote.currency`), not a closed TS literal, specifically so this confirmation wouldn't require a migration. If the business later needs to transact in a different currency, that remains a config/data change, not a schema change.

---

## D-007: Payment Gateway — OUT OF SCOPE (Confirmed Deferral)

**Classification:** Business Decision
**Status:** Deferred, not a gap — explicitly out of scope for the current phase per client instruction
**Date:** 2026-08-19

**Decision:** No payment gateway is selected or implemented in this phase. The order/checkout architecture must remain provider-agnostic: `Checkout → Payment Request → Payment Provider → Verification → Payment Success → Update Payment Status → Finalize Order → Confirmation`, with the middle steps unimplemented until the client selects a provider. Orders are fully creatable and manageable with `paymentStatus = NOT_PAID` and `orderStatus = PENDING` (spec §4-5, §8).

**Action required:** Client to confirm a payment gateway in a future phase; integration will be added as a separate module without rewriting cart/checkout/orders/customers/admin/inventory (spec §8).

---

## D-008: Tax and Shipping — Shipping RESOLVED (flat $0), Tax still OUT OF SCOPE

**Classification:** Business Decision
**Status:** Shipping resolved (flat-rate, free); tax/VAT remains deferred per explicit client instruction (spec §35-36)
**Date:** 2026-08-19 (opened), 2026-08-30 (shipping resolved)

**Original decision:** No tax calculation, VAT, shipping providers, courier integration, delivery zones, or shipping-charge calculation was implemented. Schema and checkout flow were designed to allow both to be introduced later without breaking existing order/checkout logic.

**Shipping resolution:** Client confirmed a flat shipping fee, set to **$0 (free shipping)**, rather than a carrier/zone-based model. `Order.shippingAmount` (`Decimal(12,2)`, default `0`) is now a real field, computed in `order-service.ts`'s `persistOrder` (`FLAT_SHIPPING_AMOUNT` constant) and included in `total = subtotal + shippingAmount`. Every order-creation path (cart checkout, guest checkout, quote-to-order conversion) shares this one function, so shipping is applied uniformly. If the business later adopts zone/carrier-based rates, replace `FLAT_SHIPPING_AMOUNT`'s single constant with the real calculation — the field and total-composition logic don't need to change.

**Tax/VAT: still deferred.** No tax calculation exists anywhere. Do not invent a tax rate or jurisdiction model without a client decision.

---

## D-009: CI/CD and Production Infrastructure — OUT OF SCOPE (Confirmed Deferral)

**Classification:** Business Decision
**Status:** Deferred per explicit client instruction (spec §37-38)
**Date:** 2026-08-19

**Decision:** No CI/CD pipelines, no staging/production infrastructure provisioning in this phase. The project remains CI/CD-ready: lint, typecheck, test, and build scripts exist and pass, so a pipeline can be wired up later without code changes. `.env.example` documents required environment variables for dev/staging/production without committing real secrets.

**Superseded by:** D-014 — the client explicitly requested CI/CD and hosting be set up.

---

## D-014: CI/CD and Hosting — Vercel + Supabase + GitHub Actions

**Classification:** Technical Decision (client-authorized; supersedes D-009's deferral)
**Status:** Confirmed
**Date:** 2026-08-21

**Decision:**
- **Hosting:** Vercel. Zero-config Next.js App Router deployment (auto-detects the framework, correctly splits the client bundle from server runtime — matches D-001/D-005's existing architecture, no code changes required), automatic preview deployments per PR, generous free tier appropriate for this project's current traffic.
- **Database:** Supabase (managed PostgreSQL) — connected via a **pooled** connection (`DATABASE_URL`, transaction-mode pooler, port 6543) for app runtime queries, and a separate **direct** connection (`DIRECT_URL`, port 5432) for running migrations, since PgBouncer's transaction mode doesn't support the session-level locking `prisma migrate` needs. `prisma.config.ts` was updated to use `DIRECT_URL` (falling back to `DATABASE_URL` locally, where no pooler sits in front of Postgres) for exactly this reason.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) — runs typecheck, lint, the full unit/integration suite, a production build, and the full Playwright E2E suite on every push/PR against `main`, against a disposable Postgres service container (never touches the real production database). This is a status check only; it does not deploy anything.
- **Migrations are a deliberate manual step, not automated on every deploy** — `npx prisma migrate deploy` is run explicitly from a trusted machine against production `DATABASE_URL`/`DIRECT_URL` when a schema-changing PR merges, not auto-triggered by Vercel's build. This avoids an unreviewed schema change ever firing as a side effect of an unrelated deploy.
- Added `"postinstall": "prisma generate"` to `package.json` so the generated Prisma client is always fresh after `npm install`, in CI and on Vercel alike, without relying on a manually-remembered step.

**Rationale:**
- Vercel + a managed Postgres provider is the standard, well-documented pairing for a Next.js + Prisma app, requiring no new architecture and no code changes beyond environment configuration.
- Supabase over Neon/RDS (D-002 left the specific provider open): the client's choice; its built-in connection pooler is exactly what a `pg`-driver-adapter-based Prisma setup (D-003, Prisma 7's driver-adapter model) needs in a serverless deployment.
- No staging environment, container orchestration, or secrets manager was added — Vercel's PR preview deployments already substitute for most of what a separate staging environment provides at this scale (see `docs/DEPLOYMENT.md` §5 for the explicit reasoning and its one caveat: previews currently share the production database, so destructive testing on a preview URL should be avoided until/unless per-branch database branching is added).

**Full step-by-step setup instructions:** `docs/DEPLOYMENT.md`.

**Revisit if:** traffic or compliance requirements outgrow Vercel's/Supabase's managed tiers, or per-branch preview databases become worth the added complexity.

## D-010: Email Verification / Email Sending — RESOLVED (Resend)

**Classification:** Technical Decision
**Status:** Resolved — Resend chosen and wired in
**Date:** 2026-08-19 (opened), 2026-08-30 (resolved)

**Original decision:** Phase 3 added the `emailVerified` field to the `User` model and a full password-reset token flow (`PasswordResetToken`), but did not send real email — the reset link was written to the server console only.

**Resolution:** `src/server/services/email-notifier.ts`'s `send()` now sends via the [Resend](https://resend.com) SDK when `RESEND_API_KEY` is configured (see `.env.example`), falling back to the original console-log behavior (via `console.error`, so a missing-provider misconfiguration is never mistaken for routine output) only when the key is absent — i.e. local dev without a Resend account. `authService.requestPasswordReset` required no changes — it already routed through `emailNotifier.send`. Email-verification-required login gating (item 3 of the original action list) remains a separate, still-open product decision — not resolved by this change.

**Action still open:** decide whether unverified accounts should be restricted (e.g. blocked from checkout).

---

## D-011: Notification Delivery Channel — RESOLVED (Resend)

**Classification:** Technical Decision
**Status:** Resolved — same Resend integration as D-010
**Date:** 2026-08-20 (opened), 2026-08-30 (resolved)

**Context:** Phase 15 (Notifications) requires notifying customers of order status changes, refund request approvals/rejections, and quote responses. In-app notifications shipped as the real, fully working feature; email was stubbed to a console log pending the same provider decision as D-010.

**Resolution:** `emailNotifier.send` (the single call site used by `order-service.ts`, `refund-request-service.ts`, and `quote-service.ts` via `notificationService.notify()`) now delivers through Resend — no changes were needed to any of those three call sites, confirming the D-011 architecture bet (a single swappable integration point) held up.

**Action still open:** none for delivery. Email failures are caught and logged (never thrown) so a delivery failure can never fail the order/refund/quote operation that triggered it — consistent with the original non-blocking requirement.

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

---

## D-013: E2E Test Framework and Test-Admin Credential

**Classification:** Technical Decision
**Status:** Confirmed
**Date:** 2026-08-20

**Decision:** Added `@playwright/test` as the E2E framework (Phase 18) — the one new dependency introduced this phase, justified per the master spec's "genuinely necessary dependency" allowance since browser-driven E2E testing cannot be done with the existing Vitest setup. The suite runs against `npm run dev` rather than a production build (`next build && next start`), since this project has no CI/CD pipeline yet (D-009) that would require production-build parity, and dev mode is faster to iterate against while still exercising real server components, route handlers, and the real Postgres database.

Admin-flow E2E specs authenticate as a fixed, obviously-fake, local-test-only super_admin account (`e2e-admin@example.test` / a hardcoded test password, both defined in `e2e/e2e-constants.ts`), created via `e2e/global-setup.ts` directly against whatever database `DATABASE_URL` points at when the suite runs. `example.test` is an RFC 2606 reserved testing domain that can never resolve to a real mailbox.

**Rationale:**
- This mirrors the same pattern already established for `scripts/bootstrap-super-admin.ts` (Phase 3) — a super_admin account created via direct Prisma calls, gated on the `super_admin` role already being seeded — rather than inventing a new provisioning mechanism.
- A hardcoded password string for an obviously-named, local-only throwaway test account is explicitly not the same category of risk as a hardcoded production credential (per the master spec's own carve-out for this exact scenario) — it never touches a deploy pipeline and only ever exists in a local/dev database.
- Reusing `tsx` (already a project dependency, already used for `npm run bootstrap:admin` and `prisma db seed`) to run the actual Prisma seeding logic (`e2e/seed-admin.ts`) as a child process from `global-setup.ts`, rather than importing the generated Prisma client directly into Playwright's own config/setup loader, works around a real incompatibility: Playwright's TS/ESM loader throws `ReferenceError: exports is not defined in ES module scope` on the generated (CommonJS-flavored) Prisma client when imported in-process, but `tsx` handles it without issue.

**Revisit if:** a CI/CD pipeline is set up (D-009) — at that point, consider whether the E2E suite should also run against a production build as part of that pipeline, and whether the test-admin provisioning should move to a CI-specific seed step instead of `global-setup.ts`.
