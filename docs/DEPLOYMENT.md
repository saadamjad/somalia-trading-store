# Deployment Guide

Stack: **Vercel** (app hosting) + **Supabase** (managed PostgreSQL) + **GitHub Actions** (CI). See `docs/DECISIONS.md` D-014 for why these three were chosen.

This is a step-by-step, first-time setup guide. After the first deploy, day-to-day usage is just "push to `main`" — Vercel redeploys automatically.

---

## 1. Create the production database (Supabase)

1. Create a project at [supabase.com](https://supabase.com) (pick a region close to your users — Vercel's default regions are US-based, so a nearby Supabase region reduces latency between them).
2. Set a strong database password when prompted — save it somewhere safe, you'll need it for the connection strings below.
3. Go to **Project Settings → Database → Connection pooling**. You need two connection strings from this page:
   - **Connection pooling** string (mode: Transaction, port `6543`) → this becomes `DATABASE_URL`. This is what the running app queries through.
   - **Direct connection** string (port `5432`) → this becomes `DIRECT_URL`. Only used to run migrations.

   Copy both exactly as Supabase presents them — don't hand-edit the format. `.env.example` explains why both are needed (the transaction pooler doesn't support the session-level locking `prisma migrate` requires).

4. **Run the first migration against production**, from your local machine (one-time, and again whenever a schema-changing PR merges — see §4):

   ```bash
   DATABASE_URL="<supabase pooled url>" DIRECT_URL="<supabase direct url>" npx prisma migrate deploy
   ```

   This applies every migration in `prisma/migrations/` in order. It does **not** run the seed script — decide deliberately whether you want the demo seed data (`npx prisma db seed`) in production, or whether you'd rather start with an empty catalogue and add real products through `/admin`. Most real launches skip the demo seed and add real data instead.

5. **Create your first admin account** against production:

   ```bash
   DATABASE_URL="<supabase pooled url>" \
   BOOTSTRAP_ADMIN_EMAIL="you@yourcompany.com" \
   BOOTSTRAP_ADMIN_PASSWORD="a-strong-password" \
   BOOTSTRAP_ADMIN_NAME="Your Name" \
   npm run bootstrap:admin
   ```

---

## 2. Deploy the app (Vercel)

1. Create an account at [vercel.com](https://vercel.com) and connect your GitHub account.
2. **Import Project** → select `saadamjad/somalia-trading-store`. Vercel auto-detects Next.js — no build command changes needed (the `postinstall` script already runs `prisma generate` automatically on every install).
3. Before the first deploy, set these **Environment Variables** in the Vercel project settings (Production environment):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Supabase's pooled connection string (from step 1.3) |
   | `AUTH_SECRET` | Generate with `openssl rand -base64 32` — a real production secret, different from your local `.env.local` |
   | `AUTH_URL` | Your production URL once you know it, e.g. `https://somaliatrading.com` (you can use the `*.vercel.app` URL initially and update this after adding a custom domain) |

   Do **not** set `DIRECT_URL` in Vercel — migrations are a deliberate local/manual step (§1.4, §4), not something that should run automatically on every deploy.

4. Deploy. Vercel gives you a `*.vercel.app` URL immediately.
5. Once deployed, update `AUTH_URL` to match the real URL you're using (the `.vercel.app` one, or your custom domain if you add one), then redeploy (or just push a new commit — Vercel redeploys on every push to `main`).

### Custom domain (optional)

Vercel → Project → Settings → Domains → add your domain, follow their DNS instructions (usually an `A`/`CNAME` record at your registrar). Update `AUTH_URL` to the final domain afterward.

---

## 3. Continuous Integration (already set up)

`.github/workflows/ci.yml` runs automatically on every push and pull request against `main`:
- Typecheck, lint, unit/integration tests (286 tests), production build
- Full Playwright E2E suite (customer and admin critical paths) against a real ephemeral Postgres instance

This is a **status check only** — it does not deploy anything. It exists to catch a broken PR before merge; Vercel's deploy is a separate, independent step triggered by the push itself. No further setup needed on your end; it uses GitHub's own runners and requires no secrets (CI uses a disposable local Postgres container, not your real database).

---

## 4. Ongoing workflow

**Code-only changes** (no schema change): merge to `main` → CI runs → Vercel auto-deploys. Nothing else to do.

**Schema changes** (a new Prisma migration): merging the PR does **not** apply the migration to production automatically, by design (matches the "migrations are a deliberate, controlled step" principle from §1.4). Before or right after merging:

```bash
DATABASE_URL="<supabase pooled url>" DIRECT_URL="<supabase direct url>" npx prisma migrate deploy
```

Run this from your machine (or any trusted environment with the production credentials) — treat it the same way you'd treat any production database change: understand what the migration does before applying it (`prisma/migrations/<name>/migration.sql` is always plain, readable SQL).

**Rolling back a bad deploy**: Vercel keeps every previous deployment — use "Promote to Production" on a prior deployment in the Vercel dashboard to roll back instantly. This does not roll back the database — a bad schema migration needs to be reverted with a new forward migration, not by rolling back the app alone.

---

## 5. What this setup deliberately does NOT include

Per `docs/DECISIONS.md`, staying consistent with the project's "no unnecessary infrastructure" principle:
- No staging environment — Vercel's automatic **preview deployments** on every PR already give you a live, shareable preview URL per branch, which covers most of what a separate staging environment would provide at this project's scale. Note: PR preview deployments currently point at the same production Supabase database (no automatic per-branch database) — be careful testing destructive actions (e.g. deleting products) against a preview deployment. If you want fully isolated preview databases later, Neon's branching or Supabase's preview-branching feature can be added without any application code changes.
- No container orchestration (Kubernetes/ECS/etc.) — Vercel's own infrastructure handles scaling the Next.js app; nothing in this project's traffic profile justifies that additional layer.
- No secrets manager (Vault/AWS Secrets Manager) — Vercel's built-in encrypted environment variables are the appropriate level of protection at this scale; revisit if compliance requirements change.
