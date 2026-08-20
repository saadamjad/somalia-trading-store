import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 18 — E2E configuration. Runs against `next dev` (not a production build): this
 * app has no CI/CD pipeline yet (D-009) and dev-mode is faster to iterate against
 * locally while still exercising real server components, route handlers, and the real
 * Postgres database — which is what actually matters for these specs (they verify
 * business flows, not build-output behavior).
 *
 * `globalSetup` ensures a known test-only super_admin account exists before the suite
 * runs (see e2e/global-setup.ts) — the admin flow specs log in as that account through
 * the real UI, exactly like any other user.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // The suite expects a server already running at baseURL (started by the caller —
  // see README/PRODUCTION_READINESS.md for the exact `npm run dev` + wait + test
  // sequence). No `webServer` block here: Next.js dev-server startup + first-compile
  // time is inconsistent enough that letting Playwright manage it produced flaky
  // false-timeouts in this environment; starting it explicitly and polling readiness
  // before invoking Playwright proved more reliable.
});
