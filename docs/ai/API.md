# API Surface Map

Every route under `src/app/api/**`. Auth column: **public** (no auth check), **session** (`requireSession()` — any logged-in user, usually ownership-scoped), or a **permission key** (`requirePermission("key")` — admin/staff only). Grouped to match `DATABASE.md`'s domain grouping. This is a map generated from reading the route handlers — if a route's actual behavior seems to differ from what's listed here, trust the code (`toErrorResponse` in `src/server/lib/api-errors.ts` and each route's own top-of-file comment are the fastest way to verify).

## Auth

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/auth/[...nextauth]` | GET, POST | public | Auth.js handler — session/credentials sign-in/sign-out. |

Registration and password-reset are handled by `authService` and surfaced through dedicated pages/server actions, not listed as separate REST routes here — see `src/server/services/auth-service.ts`.

## Identity / Account

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/account` | GET, PATCH | session | Read/update the current user's profile. |
| `/api/account/password` | PATCH | session | Change the current user's password (verifies current password first). |
| `/api/addresses` | GET, POST | session | List / create the current user's addresses. |
| `/api/addresses/[id]` | GET, PATCH, DELETE | session | Read/update/delete one address — ownership-checked, 404 on mismatch. |

## Catalog

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/products` | GET | public | List/filter/sort/paginate products. |
| `/api/products` | POST | `products.create` | Create a product. |
| `/api/products/[id]` | GET | public | Read one product. |
| `/api/products/[id]` | PATCH | `products.update` | Update a product. |
| `/api/products/[id]` | DELETE | `products.delete` | Delete a product (blocked by FK if it has order history — see `api-errors.ts`). |
| `/api/categories` | GET | public | List categories. |
| `/api/categories` | POST | `categories.create` | Create a category. |
| `/api/categories/[id]` | GET | public | Read one category. |
| `/api/categories/[id]` | PATCH | `categories.update` | Update a category. |
| `/api/categories/[id]` | DELETE | `categories.delete` | Delete a category (blocked by FK if it has products). |

## Inventory

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/inventory` | GET | `inventory.view` | Admin stock-level view (all products, quantity, threshold, status). |
| `/api/inventory` | PATCH | `inventory.update` | Adjust stock by a signed delta, with reason (`InventoryChangeReason`); logs an `InventoryTransaction`. |

## Cart / Wishlist

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/cart` | GET, POST | session | View / add to the current user's server-side cart. |
| `/api/cart/[productId]` | (update/remove) | session | Update quantity or remove a line item. |
| `/api/cart/validate` | POST/GET | session | Stock-validate the current cart before checkout proceeds. |
| `/api/wishlist` | GET, POST | session | View / add to the current user's wishlist. |
| `/api/wishlist/[productId]` | DELETE | session | Remove a product from the wishlist. |

## Orders

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/orders` | GET, POST | session | List the current user's own orders / place a new order from their server cart. |
| `/api/orders/[id]` | GET | session | Read one of the current user's own orders (ownership-checked, 404 on mismatch). |
| `/api/admin/orders` | GET | `orders.view` | Admin order list — search/filter/sort/paginate across all orders. |
| `/api/admin/orders/[id]` | GET | `orders.view` | Admin order detail — full audit trails, internal note. |
| `/api/admin/orders/[id]` | PATCH | `orders.update` | Update order status and/or internal note (validated against the allowed-transitions map — see `BUSINESS_RULES.md`). Never accepts `paymentStatus`. |

## Post-sale: Refunds & Quotes

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/refund-requests` | GET, POST | session | List the current user's refund requests / submit a new one for an owned, eligible order. |
| `/api/refund-requests/[id]` | GET | session | Read one of the current user's own refund requests. |
| `/api/admin/refund-requests` | GET | `refunds.view` | Admin refund request list, filter by status. |
| `/api/admin/refund-requests/[id]` | GET, PATCH | `refunds.view` / `refunds.manage` | Admin detail / approve-reject-mark-under-review. |
| `/api/quotes` | GET, POST | session for GET; **public** for POST (guest-submittable) | List the current user's quotes / submit a new quote request (no account required). |
| `/api/quotes/[id]` | GET, PATCH | session | Read own quote / customer accept-decline of a QUOTED quote. |
| `/api/admin/quotes` | GET | `quotes.view` | Admin quote list, filter by status. |
| `/api/admin/quotes/[id]` | GET, PATCH | `quotes.view` / `quotes.manage` | Admin detail / respond with pricing or plain status transition. |
| `/api/admin/quotes/[id]/convert` | POST | `quotes.manage` | Convert an ACCEPTED quote (with an associated user) into a real order at locked-in quoted prices. |

## Content (CMS)

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/cms/pages/[slug]` | GET | public | Read one **published** CMS page by slug. |
| `/api/cms/banners` | GET | public | Read active banners for a slot (`?slot=HOMEPAGE_HERO`). |
| `/api/admin/cms/pages` | GET, POST | `cms.view` / `cms.manage` | List / create CMS pages (including drafts). |
| `/api/admin/cms/pages/[id]` | GET, PATCH, DELETE | `cms.view` / `cms.manage` | Admin CMS page detail/update/delete. |
| `/api/admin/cms/banners` | GET, POST | `cms.view` / `cms.manage` | List / create banners. |
| `/api/admin/cms/banners/[id]` | GET, PATCH, DELETE | `cms.view` / `cms.manage` | Admin banner detail/update/delete. |

## Notifications

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/notifications` | GET | session | List the current user's own notifications. |
| `/api/notifications/[id]` | PATCH | session | Mark one notification read. |
| `/api/notifications/mark-all-read` | POST | session | Mark all of the current user's notifications read. |
| `/api/notifications/unread-count` | GET | session | Unread count for the header badge. |

## Admin dashboard & reports

| Path | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/admin/dashboard` | GET | `products.view` | Orders/customers/products/low-stock/refunds/quotes summary widgets, DB-derived only — never fabricated revenue figures (no payment gateway exists). |
| `/api/admin/reports` | GET | `reports.view` | Report data (product sales, orders by customer, etc.), date-range filterable. |
| `/api/admin/reports/export` | GET | `reports.view` | CSV/XLSX/PDF export of report data. |

## Notes on the pattern

- Every `admin/*` route imports `requirePermission` from `@/server/auth/permissions` and calls it as the **first** line inside the handler — permission checks happen before any input parsing.
- Every permission key follows `"<resource>.<action>"` and must exist in `prisma/seed.ts`'s `permissionKeys` array to mean anything (an unseeded key would make `requirePermission` always throw `ForbiddenError`, since `getRolePermissions` looks the key up live against the DB). See `BUSINESS_RULES.md` for the actual seeded list.
- Ownership-scoped routes (`session`-level auth) return **404**, not 403, when a resource exists but belongs to someone else — see `BUSINESS_RULES.md`'s "Customer data isolation" section.
