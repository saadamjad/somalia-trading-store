import { test, expect, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./e2e-constants";
import { loginViaUi } from "./helpers";

/**
 * Coverage for the admin CMS overhaul: the accessible delete confirmation dialog
 * (replacing window.confirm), the category parent-category picker with cycle
 * prevention, and the product image gallery's primary-image/reorder controls.
 * Creates and tears down its own disposable category fixtures rather than touching
 * seeded catalogue data.
 */
test.describe.configure({ mode: "serial" });

const runId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

async function fillCategoryForm(
  page: Page,
  opts: { name: string; slug: string; parentLabel?: string }
) {
  await page.getByLabel("Name *", { exact: true }).fill(opts.name);
  await page.getByLabel("Slug *", { exact: true }).fill(opts.slug);
  await page.getByLabel("Short Description *").fill("Disposable e2e test category.");
  await page.getByLabel("Description *", { exact: true }).fill("Created by the admin CMS overhaul e2e spec.");
  await page.getByLabel("Accent Color *", { exact: true }).fill("#8B7355");
  await page.getByLabel("Image *", { exact: true }).fill("https://images.unsplash.com/photo-1");
  await page.getByLabel("Hero Image *", { exact: true }).fill("https://images.unsplash.com/photo-2");
  if (opts.parentLabel) {
    await page.getByLabel("Parent Category").selectOption({ label: opts.parentLabel });
  }
}

async function deleteCategoryRow(page: Page, name: string) {
  const row = page.locator("tr", { hasText: name });
  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  // The dialog closing confirms the DELETE request succeeded; router.refresh()'s
  // Router Cache invalidation can still briefly lag that on the client, so a fresh
  // page.reload() confirms the change is actually live on the server rather than
  // racing this one client-side render.
  await expect(page.getByRole("alertdialog")).not.toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(row).not.toBeVisible({ timeout: 10_000 });
}

test.describe("Admin CMS overhaul", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
    await page.waitForLoadState("networkidle");
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("delete confirmation dialog: cancel keeps the item, confirm deletes it", async () => {
    const name = `E2E Delete Test ${runId}`;

    await page.goto("/admin/categories/new");
    await fillCategoryForm(page, { name, slug: `e2e-delete-test-${runId}` });
    await page.getByRole("button", { name: "Create Category" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    // The list page navigates here via router.push()+router.refresh(); reload with a
    // real full navigation rather than trust the client-side soft-nav timing, so this
    // assertion isn't racing the Router Cache invalidation.
    await page.reload();
    await expect(page.getByText(name)).toBeVisible();

    const row = page.locator("tr", { hasText: name });

    // Cancel: dialog opens, Cancel closes it, the row is still present (never
    // deleted — this is what window.confirm() could never verify).
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Are you sure?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();
    await expect(page.getByText(name)).toBeVisible();

    // Confirm: dialog opens, Delete removes the row.
    await deleteCategoryRow(page, name);
  });

  test("category parent picker: assign a parent and it persists on reload", async () => {
    const parentName = `E2E Parent ${runId}`;
    const childName = `E2E Child ${runId}`;

    await page.goto("/admin/categories/new");
    await fillCategoryForm(page, { name: parentName, slug: `e2e-parent-${runId}` });
    await page.getByRole("button", { name: "Create Category" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);

    await page.goto("/admin/categories/new");
    await fillCategoryForm(page, {
      name: childName,
      slug: `e2e-child-${runId}`,
      parentLabel: parentName,
    });
    await page.getByRole("button", { name: "Create Category" }).click();
    await expect(page).toHaveURL(/\/admin\/categories$/);
    await page.reload();

    // Re-open the child's edit form and confirm the parent selection persisted
    // through a real save + reload, not just client-side form state.
    await page.locator("tr", { hasText: childName }).getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/admin\/categories\/.+\/edit/);
    const parentSelect = page.getByLabel("Parent Category");
    await expect(parentSelect.locator("option:checked")).toHaveText(parentName);

    // The parent's own picker must not offer the child (or itself) as a valid
    // parent — cycle prevention in the UI.
    await page.goto("/admin/categories");
    await page.locator("tr", { hasText: parentName }).getByRole("link", { name: "Edit" }).click();
    await expect(page.getByLabel("Parent Category").locator(`option:has-text("${childName}")`)).toHaveCount(0);
    await expect(page.getByLabel("Parent Category").locator(`option:has-text("${parentName}")`)).toHaveCount(0);

    // Cleanup: delete child first (references parent), then parent.
    await page.goto("/admin/categories");
    await deleteCategoryRow(page, childName);
    await deleteCategoryRow(page, parentName);
  });

  test("product gallery: promote an image to primary", async () => {
    await page.goto("/admin/products");
    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page).toHaveURL(/\/admin\/products\/.+\/edit/);

    const gallery = page.getByTestId("image-gallery-images");
    const setPrimaryButtons = gallery.getByRole("button", { name: "Set primary" });
    const secondaryCount = await setPrimaryButtons.count();

    // A product with only one image has nothing to promote — nothing to assert.
    test.skip(secondaryCount === 0, "Seeded product has a single image; no reorder to test.");

    // Identify the image about to be promoted by its src, so we can confirm it's the
    // one that ends up primary (not just that *a* badge exists somewhere).
    const promotedImage = gallery.locator("img").nth(1);
    const promotedSrc = await promotedImage.getAttribute("src");

    await setPrimaryButtons.first().click();

    // Promoting an image always leaves the SAME total count of "Set primary" buttons
    // (there are still exactly `total - 1` non-primary images) — what changes is
    // *which* image is primary, not how many secondary buttons exist.
    await expect(setPrimaryButtons).toHaveCount(secondaryCount);
    await expect(gallery.getByText("Primary", { exact: true })).toBeVisible();
    await expect(gallery.locator("img").first()).toHaveAttribute("src", promotedSrc ?? "");
  });
});
