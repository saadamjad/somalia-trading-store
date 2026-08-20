import { test, expect, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./e2e-constants";
import { loginViaUi } from "./helpers";

/**
 * End-to-end coverage of the admin critical path (Phase 18 spec): Admin Login ->
 * Dashboard -> Products -> Inventory -> Orders (list, detail, status update) ->
 * Refund Requests -> Quotes.
 *
 * Logs in once (beforeAll) as the test-only super_admin account created by
 * e2e/global-setup.ts, sharing that authenticated page/context across every test in
 * this file — every admin permission exists on that role, so this exercises real
 * `requireSession`/`getRolePermissions` gates rather than bypassing them.
 */
test.describe.configure({ mode: "serial" });

test.describe("Admin critical path", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("admin dashboard loads with real data", async () => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(/Orders — Last \d+ days/)).toBeVisible();
  });

  test("products list and a product's edit form", async () => {
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(page.getByText("Premium Wooden Interior Door")).toBeVisible();

    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page).toHaveURL(/\/admin\/products\/.+\/edit/);
    await expect(page.getByLabel("Name *")).toBeVisible();
  });

  test("inventory view shows stock", async () => {
    await page.goto("/admin/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
    await expect(page.getByText("Premium Wooden Interior Door")).toBeVisible();
  });

  test("orders list, order detail, and status update", async () => {
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

    const firstOrderLink = page.locator('a[href^="/admin/orders/"]').first();
    await expect(firstOrderLink).toBeVisible();
    await firstOrderLink.click();
    await expect(page).toHaveURL(/\/admin\/orders\/[^/]+$/);

    // Only attempt a transition if this order has one available (PENDING/CONFIRMED/
    // PROCESSING/SHIPPED all do; DELIVERED/CANCELLED are terminal per
    // ALLOWED_NEXT_STATUSES in order-status-update-form.tsx).
    const updateButton = page.getByRole("button", { name: "Update status" });
    if (await updateButton.count()) {
      await updateButton.click();
      await expect(page.getByText(/moved to/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("refund requests list", async () => {
    await page.goto("/admin/refunds");
    await expect(page.getByRole("heading", { name: "Refund Requests" })).toBeVisible();
  });

  test("quotes list", async () => {
    await page.goto("/admin/quotes");
    await expect(page.getByRole("heading", { name: "Quote Requests" })).toBeVisible();
  });
});
