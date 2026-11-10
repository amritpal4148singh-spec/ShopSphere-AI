import { expect, test, type Page } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";
import { ADMIN, CUSTOMER } from "./fixtures";
import { signIn } from "./helpers";

const rows = (page: Page) => page.getByRole("table").getByRole("row");

test.beforeEach(async ({ page }) => {
  await mockDummyJson(page);
});

async function adminAt(page: Page, path: string) {
  await signIn(page, ADMIN);
  await page.goto(path);
}

test("every admin screen carries the local-simulation notice and section navigation (PRD 4.2)", async ({ page }) => {
  await adminAt(page, "/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Admin dashboard" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("simulated and saved in this browser");

  for (const [name, heading] of [
    ["Products", "Products"],
    ["Inventory", "Inventory"],
    ["Categories", "Categories"],
    ["Orders", "Orders"],
    ["Reviews", "Review moderation"],
    ["Analytics", "Recommendation analytics"],
  ] as const) {
    await page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("note")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("the overview shows totals, simulated figures, top products and low-stock alerts (PRD 8.1)", async ({ page }) => {
  await adminAt(page, "/admin");
  await expect(page.getByTestId("metric-total-products")).toHaveText("30");
  await expect(page.getByTestId("metric-total-orders")).toHaveText("6");
  await expect(page.getByTestId("metric-total-customers")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("metric-revenue")).toHaveText(/^₹/);
  // Two figures carry the tag (the intro sentence also uses the word).
  await expect(page.locator("span", { hasText: /^Simulated$/ })).toHaveCount(2);
  await expect(page.getByText("Local Analytics", { exact: true }).first()).toBeVisible();

  await expect(page.getByRole("list", { name: "Top products by simulated sales" }).getByRole("listitem")).toHaveCount(5);
  await page.getByRole("button", { name: "By rating" }).click();
  await expect(page.getByRole("list", { name: "Top products by rating" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Low-stock alerts" })).toBeVisible();
});

test("an administrator adds, edits and deletes a product locally; invalid input is rejected inline (PRD 8.2)", async ({ page }) => {
  await adminAt(page, "/admin/products/new");

  await page.getByRole("button", { name: "Create product (local)" }).click();
  await expect(page.getByText(/Enter a title of 2 to 120 characters/)).toBeVisible();
  await expect(page.getByLabel("Title")).toBeFocused();

  await page.getByLabel("Title").fill("Playwright Desk Lamp");
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("List price (INR)").fill("1499");
  await page.getByLabel("Stock (units)").fill("3");
  await page.getByRole("button", { name: "Create product (local)" }).click();
  await expect(page.getByRole("status").filter({ hasText: '"Playwright Desk Lamp" was created locally (simulation)' })).toBeVisible();

  await page.goto("/admin/products");
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Find a product").fill("Playwright");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toContainText("created locally");
  await expect(rows(page).nth(1)).toContainText("Low stock");

  await page.getByRole("link", { name: "Playwright Desk Lamp" }).click();
  await page.getByLabel("Title").fill("Playwright Desk Lamp Mk2");
  await page.getByRole("button", { name: "Save changes (local)" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved locally (simulation)" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Playwright Desk Lamp Mk2" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Playwright Desk Lamp Mk2" })).toBeVisible();

  await page.getByRole("button", { name: "Delete product" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Product removed" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: '"Playwright Desk Lamp Mk2" was removed (local simulation).' })).toBeVisible();
});

test("deleting a product that an existing order references archives it instead (PRD edge case 27)", async ({ page }) => {
  await adminAt(page, "/admin/products");
  // Product 1 is in the demo customer's sample orders.
  const firstRow = rows(page).filter({ has: page.getByRole("link", { name: "Test Product 1", exact: true }) });
  await expect(firstRow).toHaveCount(1);
  await firstRow.getByRole("button", { name: /^Delete/ }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();

  await expect(page.getByRole("status").filter({ hasText: /is in \d+ existing orders?, so it was archived instead of deleted/ })).toBeVisible();
  await expect(rows(page).filter({ has: page.getByRole("link", { name: "Test Product 1", exact: true }) })).toContainText("archived");

  await page.goto("/orders");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("inventory shows low stock and a stock adjustment is saved locally (PRD 8.2)", async ({ page }) => {
  await adminAt(page, "/admin/inventory");
  await page.getByLabel("Show").selectOption("all");
  const input = page.getByLabel("Set stock for Test Product 1", { exact: true });
  await input.fill("2");
  await page.getByRole("button", { name: "Set stock for Test Product 1", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: 'Stock for "Test Product 1" set to 2 (local simulation)' })).toBeVisible();

  await page.getByLabel("Show").selectOption("low");
  await expect(page.getByRole("row").filter({ hasText: "Test Product 1" }).first()).toContainText("Low stock");

  await page.getByLabel("Set stock for Test Product 1", { exact: true }).fill("abc");
  await page.getByRole("button", { name: "Set stock for Test Product 1", exact: true }).click();
  await expect(page.getByText(/Enter a whole number from 0 to/)).toBeVisible();
});

test("categories can be created and renamed locally", async ({ page }) => {
  await adminAt(page, "/admin/categories");
  await page.getByLabel("New category name").fill("Garden Tools");
  await page.getByRole("button", { name: "Add category (local)" }).click();
  await expect(page.getByText("garden-tools · 0 products")).toBeVisible();

  await page.getByLabel("New category name").fill("garden tools");
  await page.getByRole("button", { name: "Add category (local)" }).click();
  await expect(page.getByText("A category with this name already exists.")).toBeVisible();

  await page.getByRole("button", { name: "Rename Garden Tools" }).click();
  await page.getByLabel("Name for garden-tools").fill("Outdoor Tools");
  await page.getByRole("button", { name: "Save name (local)" }).click();
  await expect(page.getByText("Outdoor Tools", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Outdoor Tools", { exact: true })).toBeVisible();
});

test("orders can be filtered, opened, and advanced; the customer then sees the new status (PRD 8.3)", async ({ page }) => {
  await adminAt(page, "/admin/orders");
  await expect(page.getByText("6 orders")).toBeVisible();

  await page.getByLabel("Status").selectOption("delivered");
  const delivered = await rows(page).count();
  expect(delivered).toBeGreaterThan(1);
  await page.getByLabel("Status").selectOption("all");
  await page.getByLabel("Customer").selectOption({ index: 1 });
  await expect(page.getByText("6 orders")).toBeVisible();
  await page.getByLabel("Placed from").fill("2099-01-01");
  await expect(page.getByRole("heading", { name: "No orders match these filters" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();

  // Find an order that has not been delivered yet.
  await page.getByLabel("Status").selectOption("shipped");
  const link = page.getByRole("table").getByRole("link").first();
  const orderId = (await link.textContent())!.trim();
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: `Order ${orderId}` })).toBeVisible();
  await expect(page.getByText("Local simulation").first()).toBeVisible();
  await page.getByRole("button", { name: /^Advance to/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "(local simulation)" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, CUSTOMER);
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(orderId);
  await expect(page.getByText("Out for Delivery").first()).toBeVisible();
});

test("recommendation analytics: a click on a recommended product and the add-to-cart that follows are tracked (PRD 8.4)", async ({ page }) => {
  // A shopper clicks a card in the Featured rail on the home page and adds the product to the cart.
  await page.goto("/");
  const rail = page.getByRole("region", { name: "Featured Products" });
  await expect(rail).toBeVisible();
  await rail.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/products\/\d+/);
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();

  await signIn(page, ADMIN);
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { level: 1, name: "Recommendation analytics" })).toBeVisible();
  await expect(page.getByText("Local Analytics", { exact: true }).first()).toBeVisible();

  await page.getByRole("checkbox", { name: "Include simulated sample baseline" }).uncheck();
  const featured = page.getByRole("row", { name: /^Featured/ });
  const cells = featured.getByRole("cell");
  await expect(cells.nth(0)).not.toHaveText("0");
  await expect(cells.nth(1)).toHaveText("1");
  await expect(cells.nth(3)).toHaveText("1");

  await page.getByRole("button", { name: "Reset tracked events" }).click();
  await page.getByRole("button", { name: "Confirm reset" }).click();
  await expect(page.getByRole("heading", { name: "No recommendation activity tracked yet" })).toBeVisible();
});

test("the admin screens work on a phone-sized screen", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/admin/products");
  await expect(page.getByRole("table")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Analytics" })).toBeAttached();
});

test("customers and guests cannot open admin screens (PRD 4.3)", async ({ page }) => {
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, CUSTOMER);
  await page.goto("/admin/analytics");
  await expect(page.getByText("You do not have access to this page")).toBeVisible();
});
