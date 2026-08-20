# Somalia Trading Store

[![CI](https://github.com/saadamjad/somalia-trading-store/actions/workflows/ci.yml/badge.svg)](https://github.com/saadamjad/somalia-trading-store/actions/workflows/ci.yml)

A full-stack e-commerce platform for **Somalia Trading** — a diversified trading company serving construction, road infrastructure, and fishing industries across Somalia. Built as an 18-phase project (see `docs/IMPLEMENTATION_PLAN.md`); this is the completed application, not a UI-only demo.

## What this is

A real Next.js App Router application with a Postgres-backed database, authenticated customer accounts, a full admin back office, and no fake or simulated behavior anywhere — orders, inventory, refunds, and quotes are all persisted and enforced server-side. The one deliberate exception is payment: no payment gateway is integrated yet (a confirmed, documented business decision — see `docs/DECISIONS.md` D-007), so orders are created and manageable with `paymentStatus = NOT_PAID` and no online payment step.

## Features

**Customer-facing**
- Public catalogue: home, shop, category, and product detail pages, server-rendered with per-page SEO metadata, `sitemap.xml`, and `robots.txt`
- Registration, login, logout, password reset (Auth.js credentials provider, bcrypt-hashed passwords)
- Account area: profile, saved addresses, order history, order detail, refund requests, quote history, in-app notifications
- Cart and wishlist — client state synced to the server for logged-in users, stock-validated before checkout
- Checkout with real address entry/selection and server-side re-pricing (client-submitted prices/quantities are never trusted)
- Order placement, confirmation, and history — no payment step, `PENDING`/`NOT_PAID` on creation
- Refund *request* workflow (a request/approval workflow, not financial refund processing — see D-007)
- Quote request workflow

**Admin**
- Role/permission-gated admin area (Super Admin, Admin, Product Manager, Inventory Manager, Order Manager, Customer Support, Finance, Content Manager)
- Dashboard with real, DB-derived summary metrics (no fabricated revenue figures)
- Product & category CRUD
- Inventory management with full audit history (`InventoryTransaction`) and overselling prevention
- Order management: search/filter/sort/paginate, status updates with an audit trail, internal notes
- Refund request review (approve/reject)
- Quote management, including quote-to-order conversion
- Lightweight CMS for homepage/banner/static-page content (sanitized before render)
- Reports & analytics with CSV/XLSX/PDF export
- In-app + (stubbed) email notifications on order/refund/quote status changes

**Cross-cutting**
- Every authorization check enforced server-side (`requireSession`/`requirePermission`); customer data is ownership-isolated (IDOR-tested)
- Rate limiting on sensitive endpoints, security response headers (CSP, HSTS, etc.), sanitized error responses that never leak internals
- Server-side Zod validation on every API route
- Transaction-safe order creation and inventory adjustments (`prisma.$transaction`, all-or-nothing)
- 284+ automated unit/integration tests (Vitest) plus a Playwright E2E suite covering the full customer and admin critical paths

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, TypeScript (strict) |
| Styling | Tailwind CSS 4, Radix UI primitives |
| Database | PostgreSQL |
| ORM | Prisma 7 |
| Auth | Auth.js (NextAuth) credentials provider + bcrypt |
| Client state | Zustand |
| Validation | Zod |
| Animation | Framer Motion |
| Toasts | Sonner |
| Unit/integration tests | Vitest |
| E2E tests | Playwright |
| Exports | ExcelJS (XLSX), PDFKit (PDF) |

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, AUTH_SECRET, AUTH_URL
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To create your first admin account locally:

```bash
BOOTSTRAP_ADMIN_EMAIL="you@example.com" \
BOOTSTRAP_ADMIN_PASSWORD="a-strong-password" \
npm run bootstrap:admin
```

## Build

```bash
npm run build
npm start
```

## Development commands

```bash
npm run dev          # start the dev server
npm run build        # production build
npm start            # run the production build
npm run lint          # ESLint
npm run typecheck    # TypeScript, no emit
npm run test          # unit/integration test suite (Vitest)
npm run test:e2e      # Playwright E2E suite (requires a running app server — see below)
npm run bootstrap:admin  # create/promote a super_admin user from env vars
```

### Running the E2E suite locally

The Playwright suite runs against a real dev server and a real (local) Postgres database — no mocking:

```bash
npm run dev &                 # start the app in the background
npx playwright test           # runs e2e/*.spec.ts against http://localhost:3000
```

`e2e/global-setup.ts` seeds a test-only super_admin account (`e2e-admin@example.test`, a fixed local-only credential — never a production secret) before the suite runs; see that file and `docs/PRODUCTION_READINESS.md` for details.

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values for local development. Never commit `.env.local` or any file containing real credentials — see `docs/DECISIONS.md` for the variables introduced by each phase.

## Project Structure

- `src/app/` — Routes: public pages, `(auth)/` auth pages, `account/` customer area, `admin/` back office, `api/` route handlers
- `src/components/` — UI primitives, layout, product, cart, checkout, account, admin, and CMS components
- `src/server/` — Server-only code: `services/` (business logic), `repositories/` (Prisma data access), `auth/` (session/permission utilities), `lib/` (Prisma client, exports, rate limiting); see `src/server/README.md`
- `src/lib/` — Shared types, validation schemas, filters/search helpers, general utilities
- `src/stores/` — Zustand cart/wishlist/UI state
- `src/config/` — Brand, navigation, filters, SEO config
- `prisma/` — Schema, migrations, seed script
- `e2e/` — Playwright E2E specs and fixtures
- `scripts/` — One-off operational scripts (e.g. `bootstrap-super-admin.ts`)
- `docs/` — Project audit, architecture decisions, phase-by-phase implementation plan, production-readiness summary, and deployment guide

See `docs/PROJECT_AUDIT.md` (original Phase 0 state), `docs/DECISIONS.md` (architecture/business decisions, D-001–D-014+), `docs/IMPLEMENTATION_PLAN.md` (all 18 phases), `docs/PRODUCTION_READINESS.md` (final readiness checklist and known gaps), and `docs/DEPLOYMENT.md` (hosting/CI/database setup) for full project history and current status.

## Documentation

- **`docs/ai/`** — a consolidated knowledge base for AI coding agents (Claude Code, Cursor, Copilot, etc.). Start at `docs/ai/README.md` — it explains what each file covers (architecture, database, API surface, business rules, security/performance, testing/coding standards, known limitations, deferred features) and links out to the phase-by-phase docs above. Read `docs/ai/BUSINESS_RULES.md` before touching payment, orders, inventory, refunds, quotes, or authorization.
- **`docs/user/`** — plain-language guides for human users: `customer-guide.md` (browsing, cart, checkout, orders, refunds, quotes, account) and `admin-guide.md` (the back office: products, inventory, orders, refunds, quotes, CMS, reports).

## Deployment

Hosted on Vercel, database on Supabase, CI on GitHub Actions (`.github/workflows/ci.yml` — typecheck/lint/test/build/E2E on every push and PR against `main`). See `docs/DEPLOYMENT.md` for first-time setup and `docs/DECISIONS.md` D-014 for why this stack was chosen.

## Known gaps (by design, not oversight)

- **No payment gateway** — D-007, pending client choice of provider
- **No tax/shipping calculation** — D-008, explicitly out of scope for now
- **No real email delivery** — D-010/D-011; password reset and notification emails are logged to the server console pending an email provider decision
- **No Somali (i18n)** — flagged in the original audit as requiring a dedicated retrofit phase that was never scheduled; English only today

Full detail on each of these, plus the complete production-readiness checklist, is in `docs/PRODUCTION_READINESS.md`.
