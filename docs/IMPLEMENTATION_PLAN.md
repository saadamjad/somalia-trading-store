# Implementation Plan — Somalia Trading Store

Status: **Not yet authorized to begin.** Per the master spec, Phase 0 (this audit) stops here and waits for explicit client authorization before Phase 1 starts. This document is the roadmap for that future work.

Architecture decisions referenced below are recorded in `/docs/DECISIONS.md`.

## How to read this document

Each phase lists: objective, requirements, dependencies, affected files/modules, DB/API/frontend changes, tests, branch name, commit strategy, acceptance criteria, and PR requirements — per spec §57. Every phase's acceptance criteria implicitly include the **cross-cutting standards** below; they are not repeated in full under every phase to keep this document scannable.

## Cross-cutting standards (apply to every phase)

**Security**
- All authorization/permission checks enforced server-side only; frontend checks are UX convenience, never the security boundary.
- No client-supplied price, discount, quantity, inventory, or payment-status value is ever trusted — always recalculated/re-validated server-side.
- No secrets committed to source; all configuration via environment variables; `.env.example` kept current with placeholder values only.
- Passwords hashed with bcrypt; sessions managed by Auth.js; no plaintext credentials anywhere.
- Rate limiting on sensitive endpoints (auth, checkout, quote submission) once traffic patterns justify it.
- No stack traces, SQL errors, or internal implementation details exposed in API error responses.

**Data integrity**
- Order creation is transaction-safe: full rollback on any failure, no partial orders, no incorrect inventory mutation, cart not cleared unless the order actually persisted.
- Order items snapshot product name/SKU/price/quantity/discount at time of purchase — never re-derived from current product state.
- Inventory adjustments are logged with actor, previous quantity, adjustment, new quantity, reason, and timestamp.

**Code quality**
- Controller → Service → Repository separation on the backend; feature-based module folders on the frontend (`components/`, `hooks/`, `services/`, `validations/`, `types/` per feature).
- Small, focused files/functions/components — no giant files. Names are intention-revealing (no `data`, `temp`, `handleStuff`).
- Reuse existing patterns (e.g. `product-service.ts`'s method signatures) rather than inventing parallel ones; avoid abstractions used only once.

**Performance/SEO/Accessibility**
- Server-side pagination and DB indexes on filter/sort columns as soon as real data volume exists.
- Server-rendered/ISR pages for SEO-critical public routes (home, category, product) with per-page `generateMetadata`.
- Semantic HTML first; ARIA only where semantic HTML can't express the interaction.

**i18n**
- No new hardcoded user-facing strings; all copy goes through translation keys from Phase 1 onward, even before Somali translations are supplied.

**Testing & Definition of Done (spec §52)**
- A feature isn't done until: UI + backend + persistence + validation + authorization + error handling + loading/empty states + responsive behavior + tests + docs + lint/typecheck/build passing + security reviewed + no fake/mock production behavior + committed with a conventional commit message.

**Git workflow (spec §46-50)**
- One branch per phase (`feature/phase-NN-name`), one conventional commit per logical unit, one PR per phase using the template in spec §50.

---

## Demo code replacement map

(Full detail in `PROJECT_AUDIT.md` §15.) Quick reference — what gets replaced in which phase:

| Demo code | Replaced in |
|---|---|
| `src/lib/data/products.ts`, `categories.ts` | Phase 4 |
| `src/lib/services/product-service.ts` | Phase 4 |
| `CategorySlug` hardcoded union | Phase 4 |
| Checkout's fake submit handler | Phase 8 |
| Cart's `{productId, quantity}`-only shape → order items get real snapshots | Phase 8-9 |

---

## Phase 1 — Architecture & Foundation

**Objective:** Stand up the project's structural skeleton — server-code isolation, environment configuration, base tooling — without building any feature yet.

**Requirements:**
- Create `src/server/` with `services/`, `repositories/` subfolders (empty scaffolding + one example if useful for pattern-setting).
- Add `.env.example` with placeholders for `DATABASE_URL`, `AUTH_SECRET`, and any other Phase 1/2 variables — no real values.
- Add `typecheck` script (`tsc --noEmit`) to `package.json`.
- Add base test framework (Vitest recommended — fast, ESM-native, works well with Next.js/TypeScript) with one smoke test to confirm the harness runs.
- Document environment setup in a short `README` section (dev, build, test, lint, typecheck commands).

**Dependencies:** None (first phase).

**Files/modules affected:** New `src/server/` tree, `.env.example`, `package.json` scripts, `vitest.config.ts` (or chosen framework).

**DB changes:** None yet.
**API changes:** None yet.
**Frontend changes:** None — existing UI untouched.

**Tests:** One smoke test proving the test runner works.

**Branch:** `feature/phase-01-foundation`

**Commit strategy:** Separate commits for: test framework setup, `src/server/` scaffolding, `.env.example` + docs.

**Acceptance criteria:** `npm run lint`, `npm run typecheck`, `npm run build`, and the test command all pass. No behavior change to the running app.

**PR requirements:** Standard template (spec §50); Known Limitations section notes no backend logic exists yet — this is scaffolding only.

---

## Phase 2 — Database & Backend Foundation

**Objective:** Introduce PostgreSQL + Prisma, define the initial schema for entities that don't depend on auth (Category, Product, ProductImage, ProductVariant/Attribute as needed), and wire a Prisma client singleton.

**Requirements:**
- Add Prisma, initialize schema, connect to a local/dev Postgres instance via `DATABASE_URL` (documented in `.env.example`).
- Model `Category` (with nesting support per spec §11) and `Product` (fields per spec §14, informed by the existing `Product` TS interface in `src/lib/types/product.ts`) as the first migration.
- Add a Prisma client singleton pattern (`src/server/lib/prisma.ts`) to avoid connection exhaustion in dev (hot-reload safe).
- Seed script with realistic sample data for local development — clearly separate from production data, no real customer/business data.

**Dependencies:** Phase 1 (`src/server/` structure must exist).

**Files/modules affected:** `prisma/schema.prisma`, `prisma/seed.ts`, `src/server/lib/prisma.ts`, `.env.example` (add `DATABASE_URL`).

**DB changes:** Initial migration creating `Category`, `Product`, and related tables.

**API changes:** None yet — this phase is DB-only, no routes.

**Frontend changes:** None.

**Tests:** Integration test confirming Prisma client connects and a basic query round-trips against a test database.

**Branch:** `feature/phase-02-database`

**Commit strategy:** Separate commits for Prisma init, schema definition, seed script, connection singleton.

**Acceptance criteria:** `prisma migrate dev` runs cleanly on a fresh database; seed script populates it; a test query succeeds. No secrets committed — `DATABASE_URL` only via env var.

**PR requirements:** Standard template; Database Changes section documents the full schema added.

---

## Phase 3 — Authentication & Authorization

**Objective:** Implement real login/registration/session management and the roles/permissions model, server-side enforced.

**Requirements:**
- Add `User`, `Role`, `Permission` (or role-permission join) models to Prisma schema.
- Integrate Auth.js with the Prisma adapter, credentials provider, bcrypt hashing.
- Build `/login`, `/register`, `/forgot-password`, `/reset-password` pages (new — don't exist today).
- Server-side session/permission-check utilities (`src/server/auth/`) used by every future protected route handler — never trust a client-side role flag.
- Email verification flow noted as needed but implementation depends on an email-sending decision (document as open technical detail if not yet resolved — likely needs an SMTP/email provider choice, which should be logged in DECISIONS.md if genuinely blocking).

**Dependencies:** Phase 2 (needs `User` table via Prisma).

**Files/modules affected:** `prisma/schema.prisma` (User/Role/Permission), `src/app/(auth)/login`, `register`, etc., `src/server/auth/`, `src/app/api/auth/[...nextauth]/route.ts`.

**DB changes:** User, Role, Permission, UserRole/RolePermission join tables, PasswordResetToken.

**API changes:** Auth.js route handler; any custom registration/password-reset endpoints.

**Frontend changes:** New auth pages; header/nav updated to reflect logged-in state (existing `header.tsx` gains conditional auth UI — a refactor with clear justification, not a rewrite).

**Tests:** Unit tests for password hashing/validation; integration tests for registration, login, session checks, unauthorized access rejection; security test cases from spec §23 relevant to auth (account enumeration, brute force considerations, invalid credentials handling).

**Branch:** `feature/phase-03-authentication`

**Commit strategy:** Separate commits per: schema, Auth.js wiring, each new page, server-side permission utility, tests.

**Acceptance criteria:** A user can register, log in, log out; sessions persist correctly; an unauthenticated request to a protected server action/route is rejected server-side (test this explicitly, not just hide the UI).

**PR requirements:** Standard template; Security Considerations section is mandatory and detailed for this phase specifically.

---

## Phase 4 — Product & Category Management

**Objective:** Replace the mock product/category data layer with real DB-backed CRUD, admin-managed.

**Requirements:**
- Loosen `CategorySlug` from a closed TS union to a DB-driven identifier.
- Replace `src/lib/services/product-service.ts` in-memory logic with `src/server/repositories/product-repository.ts` + `src/server/services/product-service.ts` hitting Prisma — **preserve the existing method signatures** (`getAll`, `getBySlug`, `getByCategory`, `queryCategory`, `search`) so calling code changes minimally.
- Add admin product/category CRUD UI and API routes with permission checks (`products.create`, `products.update`, etc. per spec §25).
- Public-facing shop/product pages become server components fetching from the DB (enables real SEO metadata + ISR).
- Add `generateMetadata` to `/shop/[category]` and `/shop/[category]/[slug]`.

**Dependencies:** Phase 2 (schema), Phase 3 (admin auth/permissions).

**Files/modules affected:** `src/lib/services/product-service.ts` (removed, replaced), `src/lib/data/products.ts`/`categories.ts` (removed, replaced by DB), `src/server/repositories/`, `src/app/api/products/`, `src/app/api/categories/`, `src/app/admin/products/`, `src/app/shop/**` (converted to server components).

**DB changes:** ProductVariant, ProductAttribute, ProductImage, ProductTag as needed (per spec §14).

**API changes:** `/api/products` (CRUD + list/filter/paginate), `/api/categories` (CRUD).

**Frontend changes:** Shop/product pages become server-rendered; admin product management UI (new).

**Tests:** Unit tests for pricing/filtering logic; integration tests for CRUD + permission enforcement; regression test confirming existing shop UI still renders correctly against real data.

**Branch:** `feature/phase-04-products`

**Commit strategy:** Separate commits per: schema additions, repository/service layer, each API route, admin UI, public page conversion to server components, SEO metadata.

**Acceptance criteria:** All 3 demo products (plus test data) render correctly from the DB; admin can create/edit/archive a product and it reflects live; unauthorized users cannot hit admin product endpoints; product/category pages have unique metadata.

**PR requirements:** Standard template; Known Limitations notes any deferred product features (e.g. advanced variants) if scoped down for this phase.

---

## Phase 5 — Inventory

**Objective:** Real stock tracking with transaction-safe adjustments and audit history.

**Requirements:** Inventory table linked to Product/Variant; InventoryTransaction log (product, previous qty, adjustment, new qty, reason, user, timestamp per spec §15); admin UI for stock view/adjust/low-stock/out-of-stock; overselling prevention via DB-level checks in the same transaction as order creation (built fully in Phase 8, foundation laid here).

**Dependencies:** Phase 4 (products must exist for real).

**Files/modules affected:** `prisma/schema.prisma` (Inventory, InventoryTransaction), `src/server/services/inventory-service.ts`, `src/app/admin/inventory/`.

**DB changes:** Inventory, InventoryTransaction tables with appropriate constraints (no negative stock).

**API changes:** `/api/inventory` (view/adjust), permission-gated (`inventory.view`, `inventory.update`).

**Frontend changes:** Admin inventory dashboard (new).

**Tests:** Unit tests for stock adjustment logic; integration test simulating concurrent adjustment attempts to confirm no race-condition overselling.

**Branch:** `feature/phase-05-inventory`

**Acceptance criteria:** Stock can't go negative; every adjustment is logged with full audit fields; low-stock/out-of-stock views are accurate.

---

## Phase 6 — Customer Account

**Objective:** Profile, addresses, and the account area shell that later phases (orders, refunds, quotes, wishlist) plug into.

**Requirements:** `/account`, `/account/addresses` pages; profile edit (name/email/phone/password change); Address model (multiple per customer); server-side ownership checks (a customer can only ever see/edit their own data — explicit IDOR test required).

**Dependencies:** Phase 3 (auth).

**Files/modules affected:** `prisma/schema.prisma` (Address), `src/app/account/`, `src/app/api/account/`, `src/app/api/addresses/`.

**Tests:** Integration test explicitly verifying customer A cannot read/edit customer B's address or profile via direct ID manipulation (IDOR test, spec §23).

**Branch:** `feature/phase-06-customer-account`

**Acceptance criteria:** Full profile/address CRUD works; cross-customer access is rejected server-side and covered by a test.

---

## Phase 7 — Cart & Wishlist (Server-Aware)

**Objective:** Keep the existing zustand cart/wishlist UX, but make it authoritative against server-side stock/price at critical checkpoints, and support persisting a logged-in user's cart/wishlist server-side (not just localStorage).

**Requirements:** Cart/Wishlist DB models linked to authenticated users (guest carts remain localStorage-only, matching current behavior, until login); stock validation call before allowing checkout to proceed; wishlist duplicate-prevention enforced server-side, not just client-side.

**Dependencies:** Phase 4 (products), Phase 5 (inventory), Phase 6 (accounts).

**Files/modules affected:** `prisma/schema.prisma` (Cart, CartItem, Wishlist, WishlistItem), `src/stores/cart-store.ts` (extended, not rewritten — sync with server when authenticated), `src/app/api/cart/`, `src/app/api/wishlist/`.

**Tests:** Unit tests for merge logic (guest cart → logged-in cart on login); integration test for duplicate wishlist prevention; stock validation test (adding more than available stock is rejected).

**Branch:** `feature/phase-07-cart-wishlist`

**Acceptance criteria:** Existing cart/wishlist UI behavior is unchanged for guests; logged-in users get server-persisted cart/wishlist; stock is validated before checkout can proceed.

---

## Phase 8 — Checkout & Order Placement

**Objective:** Replace the cosmetic checkout with a real, payment-free order-creation flow per spec §3-5 (the platform's hard requirement).

**Requirements:**
- Real form validation (client + server) for contact/address fields.
- Order + OrderItem models with immutable snapshots (name, SKU, price, quantity, discount) — independent of `CartItem`.
- Order creation is one DB transaction: create order, create order items, decrement inventory, all-or-nothing rollback on failure.
- `orderStatus = PENDING`, `paymentStatus = NOT_PAID` on creation — never auto-marked paid, no fake payment simulation (spec §4 hard requirement).
- Order confirmation page showing a real order number; cart is cleared only after confirmed persistence, not before.
- Order confirmation triggers a notification (email, if an email provider is chosen — otherwise log/in-app notification as an interim step, documented).

**Dependencies:** Phase 6 (accounts/addresses), Phase 7 (cart), Phase 5 (inventory).

**Files/modules affected:** `prisma/schema.prisma` (Order, OrderItem), `src/app/checkout/page.tsx` (real submit logic replacing the fake handler), `src/app/api/orders/route.ts`, `src/server/services/order-service.ts`.

**Tests:** Integration test for the full happy path (cart → checkout → order created with correct status); test confirming a failed order attempt doesn't partially persist or wrongly decrement inventory; test confirming client-supplied prices are ignored in favor of server-recalculated ones (price manipulation test, spec §23).

**Branch:** `feature/phase-08-checkout`

**Acceptance criteria:** A real order can be placed end-to-end with no payment step; order data is correct and immutable; inventory reflects the order; price/quantity manipulation attempts are rejected.

---

## Phase 9 — Order Management

**Objective:** Customer order history/detail views + full admin order management per spec §6.

**Requirements:** `/account/orders`, `/account/orders/[id]` (customer, own orders only — IDOR-tested); `/admin/orders` list/search/filter/sort, order detail, status update, internal notes, order timeline; order status and payment status kept as separate fields/enums throughout (spec §5 hard requirement — never coupled).

**Dependencies:** Phase 8.

**Files/modules affected:** `src/app/account/orders/`, `src/app/admin/orders/`, `src/app/api/orders/[id]/`, `src/server/services/order-service.ts` (extended).

**Tests:** IDOR test for customer order access; permission tests for admin order status updates by role; test confirming payment status and order status update independently.

**Branch:** `feature/phase-09-order-management`

**Acceptance criteria:** Customers see only their own orders; admins can search/filter/update orders with full audit trail; status fields remain decoupled.

---

## Phase 10 — Refund/Return Workflow

**Objective:** Refund *request* workflow per spec §7 — explicitly not actual financial refund processing (that depends on the not-yet-chosen payment gateway).

**Requirements:** Customer: order → request refund → reason → submit. Admin: review → approve/reject. `RefundRequestStatus` kept separate from a future `PaymentRefundStatus` (spec §7 hard requirement).

**Dependencies:** Phase 9.

**Files/modules affected:** `prisma/schema.prisma` (RefundRequest), `src/app/account/orders/[id]/refund/`, `src/app/admin/refunds/`.

**Tests:** Full request→approve/reject flow; permission tests for admin refund actions.

**Branch:** `feature/phase-10-refunds`

**Acceptance criteria:** Refund requests can be submitted, reviewed, and resolved without any actual payment processing occurring or being implied.

---

## Phase 11 — Quote Requests

**Objective:** Formalize the existing `/quote` UI into a real, persisted workflow per spec §19.

**Requirements:** Quote/QuoteItem models; statuses (`NEW` → ... → `CONVERTED`); admin quote management; quote-to-order conversion path.

**Dependencies:** Phase 4 (products), Phase 9 (order creation, for conversion).

**Files/modules affected:** `prisma/schema.prisma` (Quote, QuoteItem), `src/app/quote/page.tsx` (real submission logic), `src/app/admin/quotes/`.

**Branch:** `feature/phase-11-quotes`

**Acceptance criteria:** Quote submissions persist; admin can manage status and convert an accepted quote into a real order.

---

## Phase 12 — CMS

**Objective:** Admin-manageable homepage/banners/static pages/FAQ per spec §22, replacing hardcoded marketing copy where it makes sense to.

**Requirements:** CMSPage/Banner models; sanitize all CMS content (XSS prevention on rich content); admin CMS editor UI.

**Dependencies:** Phase 3 (admin auth).

**Files/modules affected:** `prisma/schema.prisma` (CMSPage, Banner), `src/app/admin/cms/`, existing `home/*` components adapted to read CMS-managed content where applicable (only where it doesn't compromise the approved design).

**Branch:** `feature/phase-12-cms`

**Acceptance criteria:** Admin can edit key homepage/banner content without a code deploy; content is sanitized before render.

---

## Phase 13 — Admin Dashboard

**Objective:** Central admin overview per spec §23.

**Requirements:** Orders/customers/products/low-stock/refunds/quotes summary widgets; date filters; explicit separation between order-value metrics and actual payment/settlement data (spec §23 hard requirement — do not fabricate revenue figures given no payment gateway exists yet).

**Dependencies:** Phases 4, 5, 9, 10, 11.

**Branch:** `feature/phase-13-admin`

**Acceptance criteria:** Dashboard reflects real DB data only; no fabricated financial figures.

---

## Phase 14 — Reports & Analytics

**Objective:** Order/product/customer/inventory/refund/quote reports with CSV/XLSX/PDF export per spec §24.

**Dependencies:** Phases 4-11.

**Branch:** `feature/phase-14-analytics`

**Acceptance criteria:** Reports reflect accurate DB-derived data; exports work in all three formats without exposing internal fields inappropriately.

---

## Phase 15 — Notifications

**Objective:** In-app/email notifications for order status changes, refund updates, quote responses. Depends on an email provider decision if email is required — flag as a technical decision to resolve at phase start if not already settled.

**Dependencies:** Phases 8-11.

**Branch:** `feature/phase-15-notifications`

---

## Phase 16 — Security Hardening

**Objective:** Full pass across everything built so far against the security checklist in spec §4 (referenced in the master spec §30) and this document's cross-cutting security standards: rate limiting rollout, security headers, CORS review, dependency audit, session security review, comprehensive IDOR/permission test sweep across every endpoint built in Phases 3-15.

**Dependencies:** All prior phases.

**Branch:** `feature/phase-16-security`

**Acceptance criteria:** No unresolved findings from a systematic security pass; documented in a security review note.

---

## Phase 17 — Performance Optimization

**Objective:** Address performance at realistic scale (per DECISIONS.md scaling discussion): DB indexes on all filter/sort columns, N+1 query audit, image optimization/CDN migration for product images (currently committed to the repo — move to object storage), caching (Redis for hot paths) where genuinely warranted by measured load, not speculatively.

**Dependencies:** All prior phases.

**Branch:** `feature/phase-17-performance`

**Acceptance criteria:** Measured improvements documented (not just claimed); no premature/speculative caching added without a measured reason (spec §14, §33).

---

## Phase 18 — Testing & Production Readiness

**Objective:** Final production-readiness pass against the full checklist in spec §52/§30 of this task's originating instructions: full e2e coverage of customer and admin critical paths (spec §42), full production-readiness checklist verification, documentation sync check across all `/docs/*.md` files.

**Dependencies:** All prior phases.

**Branch:** `feature/phase-18-production-readiness`

**Acceptance criteria:** All items in the production-readiness checklist (spec §30, master instructions) are verifiably true, not just claimed.

---

## Future (explicitly deferred, not part of Phases 1-18)

- Payment gateway integration (pending client decision — DECISIONS.md D-007)
- Shipping & delivery (DECISIONS.md D-008)
- Tax/VAT (DECISIONS.md D-008)
- ~~CI/CD pipelines, staging/production infrastructure provisioning (DECISIONS.md D-009)~~ — done post-Phase-18; see DECISIONS.md D-014 and `docs/DEPLOYMENT.md`
- Advanced idempotency (becomes mandatory once payment webhooks exist)
- Accounting system integration

---

## Recommended sequencing note

Phases 1-3 are strictly sequential (foundation → DB → auth, each depends on the last). From Phase 4 onward, some parallelization is possible (e.g. CMS work in Phase 12 doesn't strictly block on Inventory in Phase 5), but the order above reflects the dependency chain that minimizes rework, and matches the spec's own phase numbering (§51).
