import { test, expect, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./e2e-constants";
import { loginViaUi, uniqueTestEmail } from "./helpers";

/**
 * End-to-end coverage of the full customer critical path (Phase 18 spec):
 * Register -> Login -> Browse -> Add to Cart -> Cart -> Checkout -> Place Order ->
 * Order Confirmation -> Order History -> Order Detail -> Refund Request. Also covers
 * the empty-cart checkout edge case.
 *
 * Runs serially against a real dev server + real Postgres (no mocking), sharing a
 * single browser page/context across all tests in this file (created once in
 * `beforeAll`) so the logged-in session and cart persist between steps — Playwright's
 * default per-test context isolation would otherwise silently log the "user" out
 * between every `test()` block.
 */
test.describe.configure({ mode: "serial" });

const customerEmail = uniqueTestEmail("e2e-customer");
const customerPassword = "E2E-test-only-password-2!";

let placedOrderId: string;

test.describe("Customer critical path", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("checkout with an empty cart is handled gracefully", async () => {
    // Checkout no longer requires login (guest checkout) — an anonymous visitor with
    // an empty cart stays on /checkout and sees the "Nothing to Checkout" empty
    // state, not a redirect. Confirm that renders cleanly, no crash, no fake order.
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Nothing to Checkout" })).toBeVisible();
  });

  test("guest checkout: place an order with no account, no login", async () => {
    // Uses its own throwaway context (never logs in) so this never touches the
    // customer session/cart the rest of this serial suite shares — see
    // order-service.ts createGuestOrder for the server-side behavior this exercises.
    const guestContext = await page.context().browser()!.newContext();
    const guest = await guestContext.newPage();

    await guest.goto("/shop/construction-materials/premium-wooden-interior-door");
    await guest.getByRole("button", { name: "Add to Cart" }).click();
    await expect(guest.getByText(/added to cart/i)).toBeVisible();

    await guest.goto("/cart");
    await guest.getByRole("link", { name: "Proceed to Checkout" }).click();
    // No redirect to /login — guest checkout stays on /checkout.
    await expect(guest).toHaveURL(/\/checkout$/);
    await expect(guest.getByText("Checking out as a guest")).toBeVisible();

    await guest.getByLabel("Full Name *").fill("E2E Guest Buyer");
    await guest.getByLabel("Email *").fill(uniqueTestEmail("e2e-guest"));
    await guest.getByLabel("Recipient Name *").fill("E2E Guest Buyer");
    await guest.getByLabel("Phone *").fill("+252611234567");
    await guest.getByLabel("Address Line 1 *").fill("456 Guest Street");
    await guest.getByLabel("City *").fill("Mogadishu");
    await guest.getByLabel("Country *").fill("Somalia");

    await guest.getByRole("button", { name: "Place Order" }).click();

    // A guest has no session, so confirmation is the public page, not
    // /account/orders/[id] — see checkout-form.tsx and checkout/confirmation/page.tsx.
    await expect(guest).toHaveURL(/\/checkout\/confirmation\?orderNumber=/, { timeout: 15_000 });
    await expect(guest.getByRole("heading", { name: "Order Placed" })).toBeVisible();

    await guestContext.close();
  });

  test("register a new customer account", async () => {
    await page.goto("/register");
    await page.getByLabel("Full Name *").fill("E2E Test Customer");
    await page.getByLabel("Email *").fill(customerEmail);
    await page.getByLabel("Phone").fill("+252611234567");
    await page.getByLabel("Password *", { exact: true }).fill(customerPassword);
    await page.getByLabel("Confirm Password *").fill(customerPassword);
    await page.getByRole("button", { name: "Create Account" }).click();
    // Registration logs the user in and redirects away from /register.
    await expect(page).not.toHaveURL(/\/register/, { timeout: 15_000 });
  });

  test("login with the registered account", async () => {
    // Confirms the credentials-provider login path independently of the
    // just-registered session (mirrors a returning customer).
    await page.context().clearCookies();
    await loginViaUi(page, customerEmail, customerPassword);
  });

  test("browse home -> shop -> category -> product detail", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    await page.getByRole("link", { name: "Explore Catalogue" }).click();
    await expect(page).toHaveURL(/\/shop$/);

    await page.getByRole("link", { name: /Construction Materials/i }).first().click();
    await expect(page).toHaveURL(/\/shop\/construction-materials/);

    await page.getByRole("link", { name: /Premium Wooden Interior Door/i }).first().click();
    await expect(page).toHaveURL(/\/shop\/construction-materials\/premium-wooden-interior-door/);
    await expect(
      page.getByRole("heading", { name: "Premium Wooden Interior Door" })
    ).toBeVisible();
  });

  test("add product to cart and view cart", async () => {
    await page.goto("/shop/construction-materials/premium-wooden-interior-door");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByText(/added to cart/i)).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByText("Premium Wooden Interior Door")).toBeVisible();
    await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toBeVisible();
  });

  test("checkout with a new address and place the order", async () => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/checkout/);

    // First-time checkout for this account: no saved addresses yet, so the new-address
    // fields render directly.
    await page.getByLabel("Recipient Name *").fill("E2E Test Customer");
    await page.getByLabel("Phone *").fill("+252611234567");
    await page.getByLabel("Address Line 1 *").fill("123 Test Street");
    await page.getByLabel("City *").fill("Mogadishu");
    await page.getByLabel("Country *").fill("Somalia");

    await page.getByRole("button", { name: "Place Order" }).click();

    // Lands on the order detail page with the ?placed=1 confirmation banner.
    await expect(page).toHaveURL(/\/account\/orders\/[^/]+\?placed=1/, { timeout: 15_000 });
    await expect(page.getByText("Order placed", { exact: true })).toBeVisible();

    const url = new URL(page.url());
    const match = url.pathname.match(/\/account\/orders\/([^/]+)/);
    expect(match).not.toBeNull();
    placedOrderId = match![1];
  });

  test("order appears in order history", async () => {
    await page.goto("/account/orders");
    await expect(page.locator(`a[href="/account/orders/${placedOrderId}"]`)).toBeVisible();
  });

  test("view order detail", async () => {
    await page.goto(`/account/orders/${placedOrderId}`);
    await expect(page.getByText("Premium Wooden Interior Door")).toBeVisible();
  });

  test("submit a refund request once the order is admin-confirmed", async () => {
    // Refund requests are only allowed on CONFIRMED/PROCESSING/SHIPPED/DELIVERED
    // orders (src/server/services/refund-request-service.ts ELIGIBLE_ORDER_STATUSES).
    // A freshly placed order starts PENDING, so advance it via the real admin API
    // first (equivalent to the admin-flow spec's status-update coverage), then submit
    // the refund request through the actual customer-facing UI. Uses a separate
    // throwaway context so the admin session never touches the customer's page/cookies.
    const adminContext = await page.context().browser()!.newContext();
    const admin = await adminContext.newPage();
    await loginViaUi(admin, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
    const patchResponse = await admin.request.patch(`/api/admin/orders/${placedOrderId}`, {
      data: { status: "CONFIRMED", note: "E2E: advancing status to allow refund request test" },
    });
    expect(patchResponse.ok()).toBeTruthy();
    await adminContext.close();

    await page.goto(`/account/orders/${placedOrderId}`);
    await expect(page.getByRole("heading", { name: "Refund Requests" })).toBeVisible();

    await page.getByLabel("Reason").selectOption("NOT_AS_DESCRIBED");
    await page
      .getByLabel("Additional details (optional)")
      .fill("E2E test refund request — not a real issue.");
    await page.getByRole("button", { name: "Request Refund" }).click();
    await expect(page.getByText(/refund request submitted/i)).toBeVisible();
  });
});
