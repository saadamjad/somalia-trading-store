# Security & Performance

## Rate limiting

In-memory, per-`${routeKey}:${ip}` sliding-window limiter (`src/server/lib/rate-limit.ts`, `checkRateLimit`). Client IP is best-effort extracted from `x-forwarded-for` (trusted — set by the platform's edge/proxy in real deployments) with an `x-real-ip` fallback and a shared "unknown" bucket for requests with neither. Named policies (`RATE_LIMITS`): `login` (10/min), `register` (5/min), `forgotPassword` (5/min), `resetPassword` (10/min), `checkout` (10/min), `quote` (10/min).

**This is per-process state.** If this app is ever horizontally scaled to multiple instances, each instance enforces its own independent limit — an attacker could get N× the effective limit by hitting different instances. **This must move to a shared store (e.g. Redis) before horizontal scaling.** This is documented in the rate-limit module's own top-of-file comment and in `docs/DECISIONS.md`, so don't "fix" it locally by adding more in-memory state — fix it by introducing a shared store when the actual scaling need arrives (see the "no premature infrastructure" note below).

## Security headers

Set in `next.config.ts`'s `headers()` function, applied to every route (`source: "/(.*)"`): `Content-Security-Policy` (no nonces — see the file's own comment for why; `script-src`/`style-src` need `'unsafe-inline'` for Next.js hydration data and Tailwind/Radix inline styles, `'unsafe-eval'` only in development), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/microphone/geolocation/browsing-topics all denied), `Strict-Transport-Security` (sent unconditionally — harmless over plain HTTP dev, meaningful over production HTTPS). `img-src` explicitly allowlists `images.unsplash.com` (matching `images.remotePatterns`) plus `data:`/`blob:` for inline/placeholder images. `connect-src 'self'` — no third-party API calls from the browser.

## Cookie / session config

Auth.js JWT session strategy, `maxAge: 30 * 24 * 60 * 60` (30 days, explicit in `src/server/auth/auth.ts` rather than left as an implicit library default). Cookie options come from Auth.js's own defaults (`node_modules/@auth/core/lib/utils/cookie.js`): `httpOnly: true`, `sameSite: "lax"`, `secure: true` whenever the deployment is HTTPS (derived from `AUTH_URL`/`trustHost` at runtime). No custom override exists — this was verified directly against the library source during Phase 16, not assumed.

## CORS stance

Same-origin only. `connect-src 'self'` in the CSP is the enforcement point; there is no CORS configuration anywhere that grants any other origin API access, and none should be added without a genuine cross-origin integration need.

## Error-handling philosophy

**Never leak stack traces, SQL errors, or internal implementation details in an API response.** `src/server/lib/api-errors.ts`'s `toErrorResponse(error)` is the single mapper every route handler's catch block should funnel errors through — it maps every domain error class (`UnauthenticatedError` → 401, `ForbiddenError` → 403, `ZodError` → 400 with `.flatten()` issues, `*NotFoundError` classes → 404, `StockUnavailableError`/`InsufficientStockError` → 409, Prisma `P2002`/`P2003`/`P2014` → 409, etc.) to a safe, specific response. Anything unmapped falls through to `console.error(error)` (server-side only) plus a generic `{ error: "Internal server error." }` at 500 — the raw error object is never serialized into the response body. When adding a new domain error class, add its mapping here rather than letting it fall through to the generic 500, so callers get an actionable status code.

## Database indexes (Phase 17)

41 `@@index` declarations across `prisma/schema.prisma`. Added by auditing actual query patterns, not speculatively. The most consequential set is on `Order` — `userId`, `orderNumber`, `status`, `paymentStatus`, `createdAt` — because `Order` is the highest-write-volume table (one row per checkout, growing forever, unlike small bounded tables like `Category`/`Role`), and `status`/`paymentStatus` are both used as standalone filters in `orderRepository.buildAdminWhere` and `dashboardRepository.orderStatusCounts`'s groupBy, while `createdAt` is the admin list's default sort column and the date-range filter used across `orderRepository.adminFindMany`, the dashboard service, and `reportRepository`. Every other model's indexes follow the same principle: indexed where an actual filter/sort/join pattern in a repository uses that column, not by default.

## "No premature caching/infrastructure" philosophy

This project has followed a consistent "build what's needed now, keep the door open for later" philosophy end to end — see `docs/DECISIONS.md` D-001 (single Next.js app, not a split backend, "revisit if traffic/team size grows") and D-005 (single deployment unit, "keep it simple, scale what actually needs scaling"). Concretely:

- No Redis/external cache exists anywhere — the rate limiter's in-memory approach is correct for the current single-instance deployment model, with the scaling caveat documented above.
- No premature pagination was added where current data volume doesn't need it (see `KNOWN_LIMITATIONS.md` — admin product/category lists) — but Phase 17 **did** add real DB-level pagination to the admin order/refund/quote lists, because those tables are unbounded and growing, unlike the small catalog.
- Phase 17's own acceptance criterion was "measured improvements documented, not just claimed; no premature/speculative caching added without a measured reason."

**When extending this app, follow the same discipline:** don't add caching, queues, or a shared rate-limit store speculatively. Do add them — and update the relevant `DECISIONS.md` entry or add a new one — when there's a concrete, measured reason (real traffic, a real horizontal-scaling plan).
