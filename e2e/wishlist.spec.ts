import { expect, test } from "@playwright/test";

import { CUSTOMER } from "./fixtures";
import { mockDummyJson } from "./dummyjson-mock";

test("the heart on a product card saves it to the wishlist and shows its price and stock status", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products");

  const heart = page.getByRole("button", { name: "Add Test Product 1 to wishlist" });
  await heart.click();

  await expect(page.getByRole("button", { name: "Remove Test Product 1 from wishlist" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();

  await page.goto("/wishlist");

  await expect(page.getByRole("heading", { level: 1, name: "Wishlist" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Test Product 1", exact: true })).toBeVisible();
  await expect(page.getByText("₹3,400")).toBeVisible();
  await expect(page.getByText("In stock", { exact: true })).toBeVisible();
});

test("the product page has a wishlist heart too", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/2");

  await page.getByRole("button", { name: "Add Test Product 2 to wishlist" }).click();

  await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();
});

test("an item that goes out of stock after being saved is marked and cannot be moved to the cart (MOD-09-001)", async ({ page }) => {
  const api = await mockDummyJson(page);
  await page.goto("/products/1");
  await page.getByRole("button", { name: "Add Test Product 1 to wishlist" }).click();
  api.overrides.stock[1] = 0;

  await page.goto("/wishlist");

  await expect(page.getByText("Out of stock", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Move to Cart" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Test Product 1", exact: true })).toBeVisible();
});

test("Move to Cart puts the item in the cart and takes it off the wishlist", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/2");
  await page.getByRole("button", { name: "Add Test Product 2 to wishlist" }).click();
  await page.goto("/wishlist");

  await page.getByRole("button", { name: "Move to Cart" }).click();

  await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wishlist, 0 items" })).toBeVisible();
});

test("an item can be removed, leaving a helpful empty state", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");
  await page.getByRole("button", { name: "Add Test Product 1 to wishlist" }).click();
  await page.goto("/wishlist");

  await page.getByRole("button", { name: "Remove Test Product 1 from wishlist" }).click();

  await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Products" })).toBeVisible();
});

test("a guest's wishlist lasts for the session only: it survives a reload but not a new tab (PRD 4.3)", async ({ page, context }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");
  await page.getByRole("button", { name: "Add Test Product 1 to wishlist" }).click();
  await page.goto("/wishlist");

  await expect(page.getByText(/kept for this browser session only/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Test Product 1", exact: true })).toBeVisible();

  const second = await context.newPage();
  await mockDummyJson(second);
  await second.goto("/wishlist");
  await expect(second.getByRole("heading", { name: "Your wishlist is empty" })).toBeVisible();
});

test("a signed-in customer's wishlist is kept, and a guest wishlist merges into it on sign-in (PRD 4.3)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");
  await page.getByRole("button", { name: "Add Test Product 1 to wishlist" }).click();

  await page.goto("/login");
  await page.getByLabel("Email").fill(CUSTOMER.email);
  await page.getByLabel("Password", { exact: true }).fill(CUSTOMER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Wishlist, 1 item" })).toBeVisible();
  await page.goto("/wishlist");
  await expect(page.getByText(/session only/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("link", { name: "Test Product 1", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Wishlist, 0 items" })).toBeVisible();
});

test("when live data cannot be loaded the wishlist shows last-known details with a retry", async ({ page }) => {
  const api = await mockDummyJson(page);
  await page.goto("/products/1");
  await page.getByRole("button", { name: "Add Test Product 1 to wishlist" }).click();
  api.failProducts = true;

  await page.goto("/wishlist");

  await expect(page.getByRole("alert").filter({ hasText: "could not check the latest prices" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Test Product 1", exact: true })).toBeVisible();
  await expect(page.getByText("₹3,400")).toBeVisible();
  await expect(page.getByRole("button", { name: "Move to Cart" })).toBeDisabled();

  api.failProducts = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("button", { name: "Move to Cart" })).toBeEnabled();
});
