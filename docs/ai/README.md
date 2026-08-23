# AI Agent Knowledge Base — Somalia Trading Store

**Future AI coding agents (Claude Code, Cursor, Copilot, or otherwise) should read this file — and skim its siblings below — before modifying this project.** This directory is the fast-orientation layer: short, current, and organized by topic. It intentionally does not duplicate the detailed historical record that already exists elsewhere in `docs/` — it links to it instead.

## What this system is

A full-stack Next.js 16 (App Router) e-commerce application for **Somalia Trading**, a company selling construction materials, road interlocks, and fishing products. It was built over 18 phases from a static UI-only demo into a real application: Postgres via Prisma, Auth.js sessions, a role/permission-gated admin back office, and full order/inventory/refund/quote workflows. There is **no payment gateway** — every order is created `PENDING`/`NOT_PAID` and that is by design, not a bug (see `docs/ai/DEFERRED_FEATURES.md`).

If you are about to change backend behavior — order status, inventory, refunds, quotes, pricing, or anything permission-related — read `docs/ai/BUSINESS_RULES.md` first. It is the single highest-stakes file in this directory for avoiding regressions.

## Files in `docs/ai/`

| File | What's in it |
|---|---|
| `ARCHITECTURE.md` | Next.js App Router structure, the Controller → Service → Repository pattern, how auth flows through the app, the Prisma 7 driver-adapter setup (and its two sharp edges), client vs. server state, and a directory-by-directory map of `src/`. |
| `DATABASE.md` | Every Prisma model, grouped by domain, summarized (purpose, key fields, key relationships) — a map, not a replacement for `prisma/schema.prisma`. |
| `API.md` | Every route under `src/app/api/**`, grouped by domain: path, method, auth requirement, one-line purpose. |
| `BUSINESS_RULES.md` | **Read this before touching payment, orders, inventory, refunds, quotes, or authorization.** Consolidates the rules that keep this app correct: payment posture, the real order status-transition map, pricing/inventory integrity, refund and quote workflows, customer data isolation, authorization. |
| `SECURITY_AND_PERFORMANCE.md` | Rate limiting, security headers, cookie/session config, CORS stance, error-handling philosophy, Phase 17 DB indexes, and the "no premature infrastructure" philosophy. |
| `TESTING_AND_CODING_STANDARDS.md` | Vitest/Playwright conventions, where tests live, the zod validation pattern, and the naming/module-boundary conventions actually followed in this codebase. |
| `KNOWN_LIMITATIONS.md` | Honest, concrete technical debt — things verified in the code, not generic boilerplate caveats. |
| `DEFERRED_FEATURES.md` | Payment gateway, tax/shipping, real email, Somali i18n, object storage — what's deferred, why, and the explicit warning not to silently implement any of these without the underlying business decision being made first. |

## The existing `docs/` files — what each is for

These already existed before this knowledge base was added. They are the detailed historical record; `docs/ai/*` is the summary layer on top of them. Don't duplicate their content here — link to them.

- **`docs/PROJECT_AUDIT.md`** — the original Phase 0 audit of the pre-existing UI-only demo: what existed, what was preserved/refactored/replaced/built new. Read this to understand where the project started.
- **`docs/DECISIONS.md`** — numbered decision records (D-001 through D-014): why each architecture/business choice was made (backend architecture, database, ORM, auth, deployment, currency, payment gateway, tax/shipping, CI/CD deferral and its later reversal, email, notifications, npm audit findings, E2E framework, CI/CD + hosting). **Check here before assuming something is a gap — it might be a confirmed, documented deferral.**
- **`docs/IMPLEMENTATION_PLAN.md`** — the full 18-phase build plan: each phase's objective, schema/API/frontend changes, tests, and acceptance criteria. This is the most detailed architecture-and-feature map of the whole app, phase by phase — useful when you need to understand *why* a particular model or route exists.
- **`docs/PRODUCTION_READINESS.md`** — the Phase 18 final report: a phase completion table, a full production-readiness checklist (verified pass/fail per item, not just claimed), known gaps, and recommended next steps for the client.
- **`docs/DEPLOYMENT.md`** — step-by-step production setup (Vercel + Supabase + GitHub Actions) and the ongoing deploy/migration workflow. See D-014.

## Git workflow (the short version)

One branch per logical unit of work, conventional commit messages (`feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`), one focused commit per logical change rather than one giant commit. `git log` is the authoritative changelog — there is no separate `CHANGELOG.md` in this project. See `docs/DECISIONS.md` D-013 for the one place git/test conventions are formally recorded (E2E test admin provisioning).

## A note on accuracy

This knowledge base was written by reading the actual code (`prisma/schema.prisma`, `src/server/services/order-service.ts`, `src/server/services/inventory-service.ts`, `src/server/auth/*`, route handlers, validation schemas) — not by re-describing the plan documents. Where the code and the plan/README disagreed (e.g. the actual seeded roles), the code wins and the discrepancy is called out in `KNOWN_LIMITATIONS.md`. If you find something here that no longer matches the code, trust the code and fix this file.
