# Testing & Coding Standards

Grounded in what this codebase actually does — not a generic style guide.

## Test frameworks and where files live

- **Vitest** for unit/integration tests — `npm run test` (`vitest run`). Test files sit **next to what they test**, suffixed `.test.ts`: `src/server/services/order-service.test.ts` next to `order-service.ts`, `src/app/api/orders/route.test.ts` next to `route.ts`, `src/lib/filters/apply-filters.test.ts` next to `apply-filters.ts`. There is no separate `__tests__/` tree.
- **Playwright** for E2E — `npm run test:e2e` (`playwright test`), specs under `e2e/` (`e2e/01-customer-flow.spec.ts`, `e2e/02-admin-flow.spec.ts`), numbered so dependent flows (e.g. an admin flow acting on an order the customer flow created) run in the right order. Runs against a real `next dev` server and a real local Postgres database — **no mocking**. `e2e/global-setup.ts` seeds a fixed, obviously-fake test-only `super_admin` account (`e2e-admin@example.test`, credentials in `e2e/e2e-constants.ts`) via `tsx` (Playwright's own TS/ESM loader can't import the generated CommonJS-flavored Prisma client in-process). See `docs/DECISIONS.md` D-013 for the full rationale.

Run them:
```bash
npm run test          # unit/integration (Vitest)
npm run test:e2e      # E2E (Playwright) — start `npm run dev` first
npm run lint           # ESLint
npm run typecheck     # tsc --noEmit
npm run build          # production build
```

## Integration-test style, not mock-heavy unit tests

Service-layer tests hit a **real database** through the same `prisma` singleton the app uses (`src/server/lib/prisma.ts`) — they are not mocked. The convention (see `inventory-service.test.ts`, `order-service.test.ts`, `auth-service.test.ts`):
- Generate a unique `runId` (`${Date.now()}-${Math.random()...}`) so parallel/repeat test runs never collide with each other or with seeded data.
- Build minimal fixture rows (a throwaway `User`, `Product`, `Inventory`, etc.) directly via `prisma.*.create` inside helper functions, tracking created ids in local arrays.
- Clean up everything created in `afterAll` (or `afterEach` where appropriate), in FK-safe order, then `prisma.$disconnect()`.
- Test emails use the `@example.test` domain (RFC 2606 reserved — can never resolve to a real mailbox), matching the E2E test-admin convention.

This mirrors the Controller → Service → Repository pattern: service tests exercise real business logic against a real DB (the layer that matters most for correctness — transactions, constraint enforcement, permission checks), while route tests (`src/app/api/**/route.test.ts`) exercise the HTTP-shape/auth-wiring layer on top.

## Controller → Service → Repository, and where tests target each layer

See `docs/ai/ARCHITECTURE.md` and `src/server/README.md` for the full pattern description. For testing purposes:
- **Repository tests** (rare — only where a repository has non-trivial query logic worth isolating, e.g. `category-repository.test.ts`) exercise Prisma queries directly.
- **Service tests** (the bulk of the suite) exercise business rules: allowed-transition maps, permission-adjacent orchestration, transaction atomicity, decoupling invariants (e.g. the order-status/payment-status decoupling test, the refund-status/payment-status decoupling test).
- **Route tests** exercise the route handler's own concerns: input validation (zod), auth gating (401/403), and correct delegation to the service layer + correct error-to-status-code mapping via `toErrorResponse`.

## The zod validation pattern

Every route handler that accepts a body or non-trivial query string parses it through a zod schema in `src/lib/validations/<domain>.ts` before calling into the service layer — see `src/lib/validations/order.ts`, `product.ts`, `quote.ts`, `refund-request.ts`, etc. for the established shape conventions:
- One schema per write operation (`productCreateSchema`, `productUpdateSchema` — often `.partial()` of the create schema), one schema per query-params shape (`orderAdminQuerySchema` with `z.coerce.number()` for page/pageSize so URL string params parse safely, sane `.min()`/`.max()` bounds so a malformed value never produces an unbounded query).
- `z.infer<typeof schema>` is exported alongside the schema as the canonical TypeScript type for that input — services and route handlers import the inferred type, not a hand-written duplicate interface.
- Fields that must never be trusted from the client (price, quantity at checkout, `paymentStatus`) are simply **absent from the schema entirely** — see `orderCreateSchema`'s own comment: this isn't "the server ignores a submitted price", it's "the API shape has no field for one at all," which is the stronger guarantee.
- A `ZodError` thrown during parsing is caught by `toErrorResponse` and turned into a 400 with `.flatten()` issues — route handlers don't hand-roll validation-error responses.

## Naming and module-boundary conventions actually followed

- **Files:** kebab-case (`order-service.ts`, `refund-request-repository.ts`, `product-mappers.ts`).
- **Repositories are Prisma-only, no business logic.** A repository method issues a query (or a small set of related queries inside a passed-in `tx`) and returns typed data — it never enforces an invariant, never checks a permission, never decides whether an operation is allowed. If you find yourself writing an `if` that decides whether an operation should proceed, that logic belongs in the service, not the repository.
- **Services own business logic and permission-adjacent orchestration**, but not the permission check itself — permission checks (`requirePermission`) live in the route handler, ownership checks (`findByIdForUser`-style scoping) live in the service. This split is consistent across every service in `src/server/services/`.
- **Domain error classes** are defined and thrown by the service that owns the invariant (e.g. `InsufficientStockError` in `inventory-service.ts`, `InvalidStatusTransitionError` in `order-service.ts`), then mapped centrally in `src/server/lib/api-errors.ts` — never `NextResponse.json(...)`'d ad hoc inside a service.
- **No giant files as a default**, but see `docs/ai/KNOWN_LIMITATIONS.md` for the one acknowledged exception (`order-service.ts`, 663 lines) and why it hasn't been split yet.
- **Small transaction-scoped helper types** (e.g. `PersistOrderParams`, `PersistOrderItemInput` in `order-service.ts`) are defined next to the function that uses them, not hoisted into a shared types file, unless genuinely reused elsewhere.
- **Reuse existing patterns rather than inventing parallel ones** — e.g. `refund-request-service.ts` and `quote-service.ts` both mirror `order-service.ts`'s allowed-transitions-map + `assertValidTransition` shape rather than each inventing their own state-machine approach.
