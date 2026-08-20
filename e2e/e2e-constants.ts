/**
 * Shared constants for the E2E suite's test-only super_admin account. A fixed,
 * obviously-fake, LOCAL-TEST-ONLY throwaway credential — not a production secret.
 * `example.test` is a reserved-for-testing TLD (RFC 2606) that can never resolve to a
 * real mailbox, and this account only ever exists in whatever local/dev database
 * `DATABASE_URL` points at when the E2E suite runs (never production — the E2E suite
 * is not wired into any deploy pipeline). See e2e/global-setup.ts and
 * e2e/seed-admin.ts.
 */
export const E2E_ADMIN_EMAIL = "e2e-admin@example.test";
export const E2E_ADMIN_PASSWORD = "E2E-test-only-password-1!";
