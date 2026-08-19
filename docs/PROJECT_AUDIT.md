# Project Audit — Somalia Trading Store

**Date:** 2026-08-19
**Scope:** Phase 0 repository audit only. No code was changed as part of this audit (aside from removing one stray duplicate file — see §9).

## 1. Current Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.0 |
| UI library | React / React DOM | 19.2.8 |
| Language | TypeScript (`strict: true`) | ^5 |
| Styling | Tailwind CSS | ^4 |
| UI primitives | Radix UI (`@radix-ui/react-*`) | various |
| Client state | zustand | ^5.0.14 |
| Animation | framer-motion | ^13.1.0 |
| Icons | lucide-react | ^1.31.0 |
| Toasts | sonner | ^2.0.8 |
| Class helpers | class-variance-authority, clsx, tailwind-merge | — |
| Linting | ESLint (flat config, `eslint-config-next`) | ^9 |

There is **no backend, no database, no ORM, no auth library, and no payment SDK** anywhere in `package.json` or the source tree.

## 2. Current Architecture

A single Next.js App Router application, 100% client-rendered:

- All page components under `src/app/` are marked `"use client"`.
- No server components perform data fetching.
- No `generateStaticParams` or `generateMetadata` on the dynamic routes (`/shop/[category]`, `/shop/[category]/[slug]`).
- No `src/app/api/` directory exists — there is no API layer of any kind.
- All "data access" happens synchronously against in-memory arrays.

This is architecturally a static marketing/demo site with interactive client state (cart, wishlist, UI toggles) layered on top — not an e-commerce backend.

## 3. Existing Modules & Pages

**Routes (`src/app/`):**

```
/                          home
/about                     about
/cart                      cart (client-only state, no persistence)
/checkout                  cosmetic checkout form (see §7)
/quote                     quote request form
/search                    client-side search over 3 mock products
/shop                      category index
/shop/[category]           category listing
/shop/[category]/[slug]    product detail
/wishlist                  wishlist (localStorage only)
```

**Missing entirely** (confirmed absent, not just unfinished):
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/account`, `/account/orders`, `/account/orders/[id]`, `/account/addresses`
- Any `/admin*` route or dashboard
- Order confirmation page (checkout shows an inline "preview" state instead)
- `sitemap.ts`, `robots.ts`

**Components (`src/components/`):**
- `ui/` — badge, button, card, input, label, motion, sheet, textarea (shadcn/Radix-style primitives, reusable, no changes needed)
- `layout/` — header, footer, search-overlay
- `home/` — hero, our-story, reviews, shop-by-category, stats-trust, trust-strip, why-choose (marketing sections, hardcoded copy)
- `product/` — category-banner, category-card, filter-panel, product-card, product-detail-client, product-listing
- `cart/` — mini-cart-drawer
- `providers.tsx` — wraps app in `<Toaster>` only; no auth/query-client/theme context providers exist yet

**Config (`src/config/`):** brand.ts, category-banners.ts, filters.ts, navigation.ts, seo.ts — all static config, reasonable to keep as-is or migrate select values (e.g. categories) to the DB later.

## 4. Existing "Business Logic" / Data Layer

- **`src/lib/data/products.ts`** — 3 hardcoded `Product` objects (one per category).
- **`src/lib/data/categories.ts`** — 3 hardcoded `Category` objects + `getCategoryBySlug()` helper.
- **`src/lib/services/product-service.ts`** — synchronous "service" object (`getAll`, `getById`, `getBySlug`, `getByCategory`, `getFeatured`, `getRelated`, `queryCategory` with pagination/filter/sort, `search`, `getSuggestions`) operating entirely on the static array. No async, no DB, no caching.
- **`src/lib/filters/apply-filters.ts`**, **`src/lib/search/search-products.ts`** — client-side filter/sort/search over the array.

**Assessment:** the `product-service.ts` method signatures (`getAll`, `getBySlug`, `getByCategory`, `queryCategory` with filter/sort/pagination params) are a **reasonable contract to preserve** when building the real repository/service layer in Phase 4 — only the implementation (sync array → async DB query) needs to change, not the shape callers depend on.

## 5. Type Definitions (`src/lib/types/`)

**`product.ts`:**
- `CategorySlug` is a **closed 3-value TS union** (`"construction-materials" | "road-interlocks" | "fishing-products"`) — categories are baked into the type system, not data-driven. Must be loosened once categories live in the DB.
- `Product` interface lacks: `updatedAt`, real inventory/stock count (only an `availability` enum), variant/option support, weight/dimensions, `taxable` flag, vendor/supplier, reviews/rating.
- `PurchasingMode: "buy_online" | "quote_only" | "both"` — useful existing signal that some products are quote-only; should carry through to the real schema and checkout logic.
- `Availability: "in_stock" | "limited" | "out_of_stock" | "made_to_order"` — reasonable starting enum for inventory status.
- `CartItem: { productId, quantity }` — no price/name snapshot. Fine for a pre-purchase cart; **order items must NOT reuse this shape** — they need immutable snapshots (see §8).
- `currency: "USD"` is a literal type — single-currency assumption baked in; must become configurable (see DECISIONS.md).

**`filter.ts`:** `FilterType`, `FilterOption`, `FilterDefinition`, `ActiveFilters` — generic, reusable filter/facet config shapes.

## 6. State Management

- **`src/stores/cart-store.ts`** — zustand + `persist` → `localStorage["somalia-trading-cart"]`. Stores only `{productId, quantity}[]`; re-derives price/name live from the current catalog via `productService.getById()`. **Risk:** once products can be edited/deleted for real, a stale cart referencing a changed/removed product will misbehave. This must be re-validated server-side at checkout regardless (spec requirement), so the risk is contained but worth noting.
- **`src/stores/wishlist-store.ts`** — zustand + `persist` → `localStorage["somalia-trading-wishlist"]`. Array of product ID strings.
- **`src/stores/ui-store.ts`** — non-persisted UI toggle state (cart drawer, mobile menu, search overlay).

No network calls exist in any store. No auth-aware state exists (e.g., no logged-in user, no session).

## 7. Checkout / Order Flow (Current State)

- **`src/app/cart/page.tsx`** — functional cart UI (quantity +/-, remove, clear, subtotal). Shipping is a hardcoded `0` labeled "Calculated at checkout". No order object created here.
- **`src/app/checkout/page.tsx`** — renders a form (contact + shipping address, plain `<Input required>`, no schema validation). On submit: `preventDefault()`, sets local `submitted` state, shows toast *"This is a preview checkout — no order was placed."*, renders a "Preview Order Complete" screen with copy explicitly stating payment/order processing isn't connected. **Form field values are never read out or persisted anywhere** — no API call, no localStorage write, no database. This is fully cosmetic by design (correctly matches the original demo scope).

**Gap to close in Phase 8:** real form validation, address/contact data capture, order creation (API + DB, `PENDING`/`NOT_PAID` per spec), and an order-confirmation page/record so the customer can look it up later (requires `/account/orders`, currently missing).

## 8. Data Integrity Considerations for Future Phases

- Order items must snapshot product name, SKU, price, and quantity at time of purchase — changing a product's price later must not alter historical orders (spec §28). The current `CartItem` shape must NOT be reused for `OrderItem`.
- No inventory concept exists yet beyond the `availability` enum — real stock counts, low-stock thresholds, and inventory transaction history need a proper schema (Phase 5).
- Order creation will need to be transaction-safe (create order + order items + inventory decrement atomically, roll back fully on any failure) — straightforward with Prisma transactions once Postgres is in place.

## 9. Technical Debt / Housekeeping

- **Resolved during this audit:** `src/app/page 2.tsx` was a stray, outdated partial duplicate of the homepage (missing several sections present in `page.tsx`). Confirmed via diff, not referenced by any route, not a stand-in for real functionality — deleted and committed separately from this audit's documentation work.
- No other dead/duplicate files were found.

## 10. Security Assessment (Current State)

- **No authentication exists** — zero matches for `auth`, `login`, `session`, `jwt`, `cookie` anywhere in `src/`. The site is fully anonymous/public.
- **No secrets in the repo** — zero `process.env` usage anywhere, no `.env`/`.env.example` file present. Nothing to leak because nothing is configured yet. (This also means: no environment-variable-driven config exists at all yet — needs to be built from scratch in Phase 1/2.)
- No server-side validation exists anywhere because no server-side code exists yet — this is expected for a static demo, but is the single largest gap to close before any real functionality (cart pricing, checkout, inventory) can be trusted.
- No rate limiting, no security headers configuration, no CORS configuration — none needed yet given there's no API surface, but all required once Phase 1/2 add one.

## 11. Performance / SEO / Accessibility (Current State)

- **Performance:** trivial at present (3 products, all client-rendered). No meaningful bottlenecks to fix yet; the concerns are entirely about what's needed once real data/traffic exists (see IMPLEMENTATION_PLAN.md Phase 17).
- **SEO:** root `layout.tsx` has basic metadata + JSON-LD Organization schema. `src/config/seo.ts` exports an unused `createPageMetadata()` helper — not currently called by any page. No `sitemap.ts`/`robots.ts`. Dynamic shop/product routes have no per-page `generateMetadata`, so they don't get unique titles/descriptions/OG tags today.
- **Accessibility:** Radix UI primitives (dialog, checkbox, select, label) provide a reasonably accessible foundation out of the box; a full audit (contrast, focus order, ARIA correctness on custom components) has not been performed and should happen alongside Phase 17/relevant feature phases, not as a one-off pass.
- **i18n:** not started. No translation library, no message files, all copy hardcoded in English directly in JSX, `<html lang="en">` fixed. Full retrofit requires extracting every user-facing string into translation keys before Somali support can be added.

## 12. Testing

Zero test files, no test framework configured (no Jest/Vitest/Playwright config anywhere). This must be established in Phase 1 (basic framework + scripts) and grown incrementally per feature, per spec §42-43.

## 13. Environment / Build Configuration

- No `.env.example` exists — must be created starting Phase 1, with placeholder values only, documenting every required variable (DB connection string, auth secret, future payment/object-storage keys) as they're introduced.
- `next.config.ts` is minimal — only `images.remotePatterns` for `images.unsplash.com`.
- `package.json` has `lint` but no `typecheck` script separate from `next build` — should add `"typecheck": "tsc --noEmit"` in Phase 1 so type errors can be caught without a full build.
- `tsconfig.json` has `strict: true` (good baseline). No extra strictness flags (`noUncheckedIndexedAccess`, etc.) — worth considering in Phase 1 but not required.

## 14. Git Structure

- Branch: `main`. History: `Initial commit from Create Next App`, then one large commit for the entire demo UI build, then the `page 2.tsx` cleanup commit.
- Going forward, per spec §46-50: every phase gets its own branch, every logical unit gets its own conventional commit, every phase gets a PR with the specified description template.

## 15. What to Preserve vs. Refactor vs. Replace vs. Build New

**Preserve as-is:**
- All `src/components/ui/*` primitives
- Overall visual design, layout components, marketing sections (approved UI/UX)
- zustand for client state (cart/wishlist/UI) — just needs price/name snapshot additions and eventual auth-awareness
- `product-service.ts` method signatures as the contract for the real service layer
- `Product`/`Category`/`Filter` type shapes as a starting schema reference

**Refactor (clear technical reason, not cosmetic):**
- `CategorySlug` union → dynamic, DB-driven
- `currency: "USD"` literal → configurable
- Cart/order type separation (`CartItem` vs. `OrderItem` with snapshots)

**Replace (real reason: no backend exists to replace it with):**
- `src/lib/data/products.ts`, `categories.ts` → Postgres via Prisma
- `src/lib/services/product-service.ts` in-memory logic → real repository/service hitting the DB
- Checkout's fake submit handler → real order-creation flow

**Build new (doesn't exist at all today):**
- Entire backend: API routes, services, repositories, database, migrations
- Authentication & authorization (all roles/permissions from spec §25)
- Account area, admin dashboard, order management, inventory, refunds, quotes, CMS, reporting
- Test suite (unit/integration/e2e)
- i18n infrastructure
- `.env.example`, sitemap/robots, per-page SEO metadata

See `/docs/IMPLEMENTATION_PLAN.md` for the phase-by-phase breakdown of this work, and `/docs/DECISIONS.md` for the architecture decisions and open business questions.
