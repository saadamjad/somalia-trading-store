/**
 * Playwright global setup — runs once before the E2E suite.
 *
 * Ensures a known test-only super_admin account exists (see e2e/e2e-constants.ts for
 * the credentials and why they're safe to keep in source). The actual Prisma work
 * lives in e2e/seed-admin.ts and runs via `tsx` in a child process — Playwright's own
 * config/setup loader can't import the generated Prisma client directly (it throws
 * `ReferenceError: exports is not defined in ES module scope` on that generated,
 * CommonJS-flavored file), but `tsx` — the same runtime `npm run bootstrap:admin`
 * already uses elsewhere in this repo — handles it without issue.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

export default async function globalSetup() {
  execFileSync("npx", ["tsx", path.join(__dirname, "seed-admin.ts")], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
}
