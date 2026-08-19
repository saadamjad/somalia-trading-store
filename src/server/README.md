# `src/server/`

Server-only code. Nothing in this tree is ever bundled into the browser — enforced by the Next.js build, not by convention alone (see `docs/DECISIONS.md`, D-001).

## Layout

- `repositories/` — data access only (Prisma queries). No business rules, no permission checks.
- `services/` — business logic and orchestration. Calls repositories, enforces invariants (e.g. stock can't go negative), never talks to Prisma directly.
- `lib/` — shared server-only infrastructure (e.g. the Prisma client singleton, added in Phase 2).
- `auth/` — added in Phase 3: session/permission-check utilities used by route handlers.

## Pattern

Route handler (`src/app/api/**/route.ts`) → Service (`services/`) → Repository (`repositories/`).

A route handler authenticates the request and calls a service method. A service method enforces business rules and permission checks, then calls one or more repository methods. A repository method issues Prisma queries and returns typed data — nothing else.

Existing method signatures in `src/lib/services/product-service.ts` (`getAll`, `getBySlug`, `getByCategory`, `queryCategory`, `search`) are the contract to preserve when this pattern replaces it in Phase 4 — only the implementation moves from an in-memory array to a real repository call.
