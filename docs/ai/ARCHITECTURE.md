# Architecture

## Big picture

One Next.js 16 App Router application, deployed as a single unit (D-001, D-005). No separate backend service — server-only code is kept out of the browser bundle by the Next.js build itself, not by convention. See `docs/DECISIONS.md` D-001 for why a split backend was considered and rejected for now.

```
Browser
  │
  ▼
Route handler (src/app/api/**/route.ts)   ── authenticates the request, parses/validates input, translates errors
  │
  ▼
Service (src/server/services/*.ts)         ── business rules, permission-adjacent orchestration, transactions
  │
  ▼
Repository (src/server/repositories/*.ts)  ── Prisma queries only, no business logic
  │
  ▼
PostgreSQL (via Prisma 7 + @prisma/adapter-pg)
```

This is the **Controller → Service → Repository** pattern. The canonical description of it lives in `src/server/README.md` — read that file rather than expecting a restatement here; the short version is: a route handler authenticates and calls a service method, a service method enforces invariants and permission checks, and a repository method issues Prisma queries and returns typed data, nothing else.

## Two Prisma 7 gotchas future agents WILL hit

1. **Import the generated client from `"@/generated/prisma/client"`, not `"@/generated/prisma"`.** The generator is configured with `output = "../src/generated/prisma"` in `prisma/schema.prisma`, and Prisma 7's `prisma-client` generator produces a `client.ts` inside that output directory — there is no `index.ts`/barrel file at the bare `@/generated/prisma` path. Every existing import in this codebase (`src/server/lib/prisma.ts`, every repository, every service that imports Prisma-generated types) uses the `/client` suffix. Follow that pattern.

2. **`PrismaClient` must be constructed with a `PrismaPg` adapter, not a bare `DATABASE_URL` in `schema.prisma`.** Prisma 7 forbids `url = env("DATABASE_URL")` in the `datasource` block when using the driver-adapter model — `prisma/schema.prisma`'s `datasource db` block only declares `provider = "postgresql"`, no `url`. The actual connection string is read at runtime in `src/server/lib/prisma.ts`:
   ```ts
   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
   export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
   ```
   `prisma/seed.ts` follows the same pattern. If you write a new script that touches the database directly, construct the client the same way — a bare `new PrismaClient()` without an adapter will not work against this schema.

## Auth flow

Auth.js (NextAuth) with a **Credentials provider only** — no OAuth, no `@auth/prisma-adapter`, no `Account`/`Session`/`VerificationToken` tables (D-004). Session strategy is **JWT** (`src/server/auth/auth.ts`), because Credentials is incompatible with Auth.js's database-backed session strategy. `authorize()` delegates to `authService.verifyCredentials`, which fails the same way whether the email doesn't exist or the password is wrong — this prevents account enumeration via response differences.

Two server-side utilities every protected route handler goes through (`src/server/auth/`):

- **`requireSession()`** (`session.ts`) — returns the current `{ userId, email, name, role }` or throws `UnauthenticatedError`. This is the only source of truth for "who is making this request" — never trust a client-supplied user id or role.
- **`requirePermission(key)`** (`permissions.ts`) — calls `requireSession()`, then re-derives the role's permission set **live from the database** (`Role → RolePermission → Permission`) and throws `ForbiddenError` if the permission is missing. It never trusts a role string embedded in the JWT as authorization by itself — the JWT only carries which role the user has; what that role can do is always looked up fresh.

`src/server/lib/api-errors.ts`'s `toErrorResponse()` is the single place `UnauthenticatedError` → 401 and `ForbiddenError` → 403 get mapped to HTTP responses — every route handler's catch block should funnel errors through it (see `SECURITY_AND_PERFORMANCE.md`).

## Client vs. server state

- **Zustand stores** (`src/stores/`) hold client-side UI and cart/wishlist state: `cart-store.ts`, `wishlist-store.ts` (both `persist`-backed to `localStorage` for guests), `ui-store.ts` (non-persisted UI toggles — cart drawer, mobile menu, search overlay).
- **Server-synced cart/wishlist** (Phase 7): once a user is logged in, `Cart`/`CartItem` and `Wishlist`/`WishlistItem` rows in Postgres become the authoritative source, reached via `/api/cart` and `/api/wishlist`. Guest carts remain localStorage-only until login — there is no guest-cart-in-DB concept.
- Prices are **never** stored in cart state as trusted values — both the client store and the server `CartItem` model store only `{ productId, quantity }`; price is always re-derived live from the current `Product` row at read time, and re-derived again (and snapshotted) at order-creation time. See `BUSINESS_RULES.md` for why this matters.

## Directory map (`src/`)

```
src/
  app/
    (auth)/           login, register, forgot-password, reset-password
    account/           customer area — profile, addresses, orders, quotes, notifications
    admin/             admin back office — products, categories, inventory, orders, refunds,
                        quotes, cms, reports (permission-gated per src/app/admin/layout.tsx)
    api/               route handlers — see API.md for the full surface
    shop/, cart/, checkout/, wishlist/, search/, quote/, faq/, about/
                       public-facing pages
  components/          ui/ (Radix-based primitives), layout/, product/, cart/, checkout/,
                        account/, admin/, cms/, home/ (marketing sections)
  server/               server-only code — never bundled to the browser
    services/           business logic (see BUSINESS_RULES.md for the rules encoded here)
    repositories/       Prisma-only data access, no business logic
    auth/                session.ts, permissions.ts, auth.ts, password.ts
    lib/                 prisma.ts (client singleton), api-errors.ts, rate-limit.ts,
                        export/ (csv.ts, xlsx.ts, pdf.ts — report generation)
  lib/
    validations/         zod schemas — one per domain, mirrored 1:1 against API.md's routes
    types/, filters/, search/, utils.ts  shared types and filter/search helper logic.
                        The pre-Phase-4 static `data/` and `services/` directories
                        (hardcoded products/categories array + in-memory product-service —
                        see docs/PROJECT_AUDIT.md) were fully removed in Phase 4, replaced
                        by the DB-backed `src/server/repositories/product-repository.ts` +
                        `src/server/services/product-service.ts` — they no longer exist.
  stores/               Zustand: cart-store.ts, wishlist-store.ts, ui-store.ts
  config/                brand.ts, navigation.ts, filters.ts, seo.ts, category-banners.ts
  generated/prisma/      Prisma-generated client — do not hand-edit
prisma/
  schema.prisma          authoritative schema — see DATABASE.md for a summarized map
  migrations/             one directory per migration; the Inventory CHECK constraint is
                        hand-added to a migration.sql (Prisma's schema DSL has no native
                        syntax for arbitrary CHECK constraints at this version)
  seed.ts                 categories, products, inventory, permissions, roles
e2e/                     Playwright specs + global-setup.ts (seeds a test-only admin account)
scripts/                 bootstrap-super-admin.ts and other one-off operational scripts
```

## Server rendering vs. client components

Public shop/product pages (`/shop`, `/shop/[category]`, `/shop/[category]/[slug]`) are server components fetching from the DB via `productService`, with `generateMetadata` for per-page SEO (added Phase 4). Admin pages and most interactive customer-facing forms are client components. `sitemap.ts` and `robots.ts` (added Phase 18) are DB-driven off `productService.getAll()`, not hardcoded.
