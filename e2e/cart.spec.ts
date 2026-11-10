import { expect, test, type Page } from "@playwright/test";

import { getVariantGroup } from "../src/services/products/variants";
import { CUSTOMER } from "./fixtures";
import { mockDummyJson } from "./dummyjson-mock";

/** Stock of the variant the product page selects by default (first in-stock option). Product 1 is a ₹3,400 shoe. */
function defaultStock(id: number, category: string, stock = 25): number {
  const group = getVariantGroup({ id, category, stock })!;
  return (group.options.find((option) => option.stock > 0) ?? group.options[0]!).stock;
}

async function addFromProductPage(page: Page, id: number, expected = "Added to your cart.") {
  await page.goto(`/products/${id}`);
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByText(expected)).toBeVisible();
}

const summary = (page: Page) => page.getByRole("complementary", { name: "Order summary" });

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(CUSTOMER.email);
  await page.getByLabel("Password", { exact: true }).fill(CUSTOMER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

test("adding from the product page puts the item in the cart with a summary", async ({ page }) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 1);
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();

  await page.goto("/cart");

  await expect(page.getByRole("heading", { level: 1, name: "Shopping cart" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Test Product 1", exact: true })).toBeVisible();
  await expect(summary(page)).toContainText("Subtotal (1 item)");
  await expect(summary(page)).toContainText("Shipping (simulated)");
  await expect(summary(page)).toContainText("(simulated)");
  await expect(page.getByTestId("cart-total")).toContainText("₹");
});

test("adding the same product again increments one row instead of duplicating it (edge case 8)", async ({ page }) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 1);
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByText(/already in your cart/)).toBeVisible();

  await page.goto("/cart");

  await expect(page.getByRole("textbox", { name: "Quantity for Test Product 1" })).toHaveValue("2");
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Cart, 2 items" })).toBeVisible();
});

test("a quantity above the stock is corrected with an inline explanation and the totals follow (MOD-05-001)", async ({ page }) => {
  await mockDummyJson(page);
  const stock = defaultStock(1, "mens-shoes");
  await addFromProductPage(page, 1);
  await page.goto("/cart");

  const quantity = page.getByRole("textbox", { name: "Quantity for Test Product 1" });
  await quantity.fill(String(stock + 5));
  await quantity.press("Enter");

  await expect(
    page.getByText(`You asked for ${stock + 5}, but only ${stock} ${stock === 1 ? "is" : "are"} in stock. The quantity is now ${stock}.`),
  ).toBeVisible();
  await expect(quantity).toHaveValue(String(stock));
  await expect(summary(page)).toContainText(`₹${(3400 * stock).toLocaleString("en-IN")}`);
});

test("coupons show clear invalid, expired and applied states (PRD 5.5)", async ({ page }) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 8); // ₹42,500
  await page.goto("/cart");

  const code = page.getByLabel("Coupon code");
  await code.fill("NOPE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText('"NOPE" is not a valid coupon code.')).toBeVisible();

  await code.fill("SUMMER25");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/SUMMER25 expired on/)).toBeVisible();

  await code.fill("save10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("SAVE10 applied. You save ₹1,000.")).toBeVisible();
  await expect(summary(page)).toContainText("-₹1,000");

  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByLabel("Coupon code")).toBeVisible();
  await expect(summary(page)).not.toContainText("-₹1,000");
});

test("a minimum-order coupon explains how much more is needed", async ({ page }) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 13); // ₹850
  await page.goto("/cart");

  await page.getByLabel("Coupon code").fill("WELCOME200");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByText(/needs a subtotal of at least ₹1,500/)).toBeVisible();
});

test("Save for Later moves an item out of the cart and back", async ({ page }) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 1);
  await page.goto("/cart");

  await page.getByRole("button", { name: "Save for later" }).click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved for later (1)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 0 items" })).toBeVisible();

  await page.getByRole("button", { name: "Move to cart" }).click();
  await expect(page.getByRole("textbox", { name: "Quantity for Test Product 1" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
});

test("a price change is shown and must be confirmed before checkout (edge case 10)", async ({ page }) => {
  const api = await mockDummyJson(page);
  await addFromProductPage(page, 1); // ₹3,400
  api.overrides.priceUsd[1] = 50; // now ₹4,250

  await page.goto("/cart");

  await expect(page.getByText("Price changed.")).toBeVisible();
  await expect(page.getByText("It was ₹3,400 and is now ₹4,250.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Proceed to Checkout" })).toBeDisabled();

  await page.getByRole("button", { name: "Accept new price" }).click();

  await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toBeVisible();
  await expect(page.getByTestId("cart-total")).toContainText("₹5,015");
});

test("a product that is no longer returned is flagged and blocks checkout until removed (edge case 1)", async ({ page }) => {
  const api = await mockDummyJson(page);
  await addFromProductPage(page, 1);
  api.overrides.removed.add(1);

  await page.goto("/cart");

  await expect(
    page.getByText("No longer available.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Proceed to Checkout" })).toBeDisabled();
  await expect(page.getByText("Test Product 1 is no longer available. Remove it.")).toBeVisible();

  await page.getByRole("button", { name: "Remove Test Product 1 from cart" }).click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
});

test("an item that sells out after being added is flagged in place (PRD 5.5)", async ({ page }) => {
  const api = await mockDummyJson(page);
  await addFromProductPage(page, 1);
  api.overrides.stock[1] = 0;

  await page.goto("/cart");

  await expect(page.getByText("Out of stock.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Proceed to Checkout" })).toBeDisabled();
  await expect(page.getByText("Test Product 1 is out of stock. Remove it or save it for later.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Quantity for Test Product 1" })).toBeDisabled();
});

test("when live data cannot be loaded the cart shows its last-known details with a retry (PRD 5.5)", async ({ page }) => {
  const api = await mockDummyJson(page);
  await addFromProductPage(page, 1);
  api.failProducts = true;

  await page.goto("/cart");

  await expect(page.getByRole("alert").filter({ hasText: "could not check the latest prices" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Test Product 1", exact: true })).toBeVisible();
  await expect(page.getByTestId("cart-total")).toContainText("₹");

  api.failProducts = false;
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "could not check the latest prices" })).toHaveCount(0);
});

test("the cart survives a reload, and a second tab sees changes without reloading (edge case 26)", async ({ page, context }) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 1);
  await page.reload();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();

  const second = await context.newPage();
  await mockDummyJson(second);
  await second.goto("/");
  await expect(second.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();

  await addFromProductPage(page, 2);

  await expect(second.getByRole("link", { name: "Cart, 2 items" })).toBeVisible();
  await second.goto("/cart");
  await expect(second.getByRole("heading", { level: 3 })).toHaveCount(2);
});

test("checkout from the cart asks a guest to sign in first", async ({ page }) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 1);
  await page.goto("/cart");

  await page.getByRole("link", { name: "Proceed to Checkout" }).click();

  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
});

test("Buy Now adds the item and goes to checkout (sign-in first for a guest)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");

  await page.getByRole("button", { name: "Buy Now" }).click();

  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
});

test("a guest's cart merges into the customer's cart on sign-in, and the account cart survives sign-out (PRD 4.3)", async ({
  page,
}) => {
  await mockDummyJson(page);
  await addFromProductPage(page, 1);
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();

  await signIn(page);
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Cart, 0 items" })).toBeVisible();

  await signIn(page);
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
});

test("the cart page is usable at mobile width without horizontal scrolling", async ({ page }) => {
  await mockDummyJson(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await addFromProductPage(page, 1);
  await page.goto("/cart");

  await expect(page.getByRole("heading", { level: 1, name: "Shopping cart" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
