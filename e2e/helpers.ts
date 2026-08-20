import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Logs in through the real /login form (used by both customer and admin specs). */
export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email *").fill(email);
  await page.getByLabel("Password *").fill(password);
  await page.getByRole("button", { name: "Log In" }).click();
  // Successful login redirects away from /login (either "/" or a callbackUrl).
  await expect(page).not.toHaveURL(/\/login/);
}

/** Generates a unique, obviously-test-scoped email for a fresh customer registration. */
export function uniqueTestEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}
