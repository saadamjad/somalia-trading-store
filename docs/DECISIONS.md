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
