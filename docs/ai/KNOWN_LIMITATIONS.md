# Known Limitations

Honest, concrete technical debt — every entry here was verified directly against the code, not inferred generically. If you fix one of these, remove it from this list in the same change.

## `order-service.ts` is a large file (663 lines)

Verified via `wc -l src/server/services/order-service.ts`. It's large but not unmanageable today — it holds the entire order-creation transaction core (`persistOrder`, shared by both normal checkout and quote conversion), plus all order-query and admin-status-update methods, plus the view-shaping (`toOrderView`, `toStatusHistoryEntry`) for all of the above. It is a **candidate for future decomposition** into creation-concerns (`persistOrder`, `createOrder`, `createOrderFromPricedItems`) vs. query-concerns (`listForUser`, `getOwned`, `adminList`, `adminGetById`, `updateStatus`, `updateInternalNote`) if it keeps growing — not an urgent problem today, and splitting it prematurely would risk breaking the carefully-commented transaction-safety pattern that's currently all in one place and easy to audit as a unit.

## Admin product/category lists have no DB-level pagination

`src/server/repositories/product-repository.ts`'s `findAll()` calls `prisma.product.findMany({ include: withCategory, orderBy: { createdAt: "desc" } })` with no `take`/`skip` — same pattern for categories. This is a documented Phase 17 tradeoff, not an oversight: the catalog is currently ~9 products across 3 categories, so fetching "everything" is trivially fast and pagination would add complexity with no current benefit. **This becomes a real problem once the catalog grows into the hundreds+** — if you're adding bulk product import or a much larger catalog, add real `take`/`skip` pagination to these repository methods and their admin list UIs before that happens, not after.

## Refund/quote report date-range filtering is in-memory, not pushed into SQL

`src/server/services/report-service.ts` defines `REPORT_ROW_CAP = 5000` — reports fetch up to 5000 rows and then filter/aggregate by date range in application code rather than pushing the date-range predicate into the SQL query itself. This is a documented Phase 14 tradeoff: at current data volume it's fast and simple, but it means a report can silently be **incomplete** (not wrong, but truncated) once total row count for the underlying table exceeds 5000 within the relevant time window. If report accuracy at scale becomes a real requirement, push the date filtering into the Prisma query (`where: { createdAt: { gte, lte } }`) rather than raising the cap.

## Two accepted `npm audit` findings (D-012)

Both documented in detail in `docs/DECISIONS.md` D-012 — summarized here:
1. **`deepmerge-ts` stack exhaustion** (high, via `@prisma/config` → `prisma`) — exposure is a CLI/build-time tooling DoS (`prisma migrate`/`generate`), not the runtime query path this app's request handlers actually use. No safe fix available without downgrading Prisma to a breaking major (6.x). Revisit when Prisma ships a stable 8.x or a 7.x patch.
2. **`uuid` missing buffer bounds check** (moderate, via `exceljs`) — the vulnerable code path (`uuid`'s `v3`/`v5`/`v6` with an explicit buffer argument) is never reached by `exceljs`'s actual usage (`uuidv4()`, no buffer arg). No safe fix available without downgrading `exceljs` to a breaking major. Revisit when `exceljs` ships a release depending on `uuid@>=11.1.1`.

Do not "fix" either of these with `npm audit fix --force` or a blind `overrides` entry — both were deliberately rejected as disproportionate (see D-012's full rationale).

## Only two roles are actually seeded, not the full documented role model

`prisma/seed.ts`'s `seedAuth()` creates exactly two roles: `customer` (no permissions) and `super_admin` (every permission). The README and `docs/DECISIONS.md` D-004 describe a richer intended role model (Admin, Product Manager, Inventory Manager, Order Manager, Customer Support, Finance, Content Manager) as the target design that motivated building a custom permissions system instead of using a managed auth provider — but no seed data, migration, or application code anywhere actually creates those additional roles or assigns them a curated permission subset. Verified via a codebase-wide search for those role names — zero matches outside prose documentation. **Practical consequence:** every admin capability in this app today is only reachable by a `super_admin` account; there is currently no way to grant, say, an inventory-only staff member access to `/admin/inventory` without also giving them every other admin permission. See `docs/ai/BUSINESS_RULES.md`'s Authorization section. If a future phase adds the additional roles, update this entry and `BUSINESS_RULES.md` together.

## No dedicated Terms/Privacy/Refund/Shipping policy CMS pages yet

`src/app/faq/page.tsx` exists and is the one working example of the CMS-page-rendering pattern (`CMSPage.body` as structured JSON blocks, rendered without `dangerouslySetInnerHTML` — see `DATABASE.md`). No Terms of Service, Privacy Policy, Refund Policy, or Shipping Policy page exists in the codebase as of this writing (verified: no matching route/file found). If these are added later, they should follow the same `CMSPage` pattern as FAQ rather than a new one-off page type, and `docs/user/admin-guide.md`'s CMS section should be updated to mention them.
