import { expect, test } from "@playwright/test";

import { getVariantGroup } from "../src/services/products/variants";
import { mockDummyJson } from "./dummyjson-mock";

test("opening a product from the grid shows its details", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products");

  await page.getByRole("link", { name: "Test Product 1", exact: true }).click();

  await expect(page).toHaveURL(/\/products\/1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Test Product 1" })).toBeVisible();
  await expect(page.getByText("(3 reviews)")).toBeVisible();
  await expect(page.getByText("₹3,400")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Test Product 1");
  await expect(page).toHaveTitle(/Test Product 1/);
});

test("gallery thumbnails switch the main image", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");

  const thumbnails = page.getByRole("list", { name: "Product images" }).getByRole("button");
  await expect(thumbnails.first()).toHaveAttribute("aria-current", "true");

  const main = page.getByTestId("gallery-main").getByRole("img");
  const before = await main.getAttribute("src");

  await thumbnails.nth(1).click();

  await expect(thumbnails.nth(1)).toHaveAttribute("aria-current", "true");
  await expect.poll(async () => main.getAttribute("src")).not.toBe(before);
});

test("an out-of-stock variant disables Add to Cart with an explanation while other variants stay selectable (MOD-04-001)", async ({
  page,
}) => {
  await mockDummyJson(page);
  await page.goto("/products/3");

  // Product 3 is a multiple of three, so exactly one size is sold out (same rules as the app).
  const group = getVariantGroup({ id: 3, category: "mens-shoes", stock: 25 })!;
  const soldOut = group.options.find((option) => option.stock === 0)!;
  const available = group.options.filter((option) => option.stock > 0);

  await expect(page.getByRole("button", { name: "Add to Cart" })).toBeEnabled();

  await page.getByRole("radio", { name: `${soldOut.label} (out of stock)` }).check({ force: true });

  await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  await expect(page.getByText("This size is out of stock. Choose another size to continue.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy Now" })).toBeDisabled();

  await page.getByRole("radio", { name: available[0]!.label, exact: true }).check({ force: true });

  await expect(page.getByRole("button", { name: "Add to Cart" })).toBeEnabled();
});

test("the quantity stepper is bounded by the available stock", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/100");

  await expect(page.getByText("Only 3 left in stock")).toBeVisible();

  const increase = page.getByRole("button", { name: "Increase quantity" });
  await increase.click();
  await increase.click();

  await expect(page.getByRole("textbox", { name: "Quantity" })).toHaveValue("3");
  await expect(increase).toBeDisabled();
  await expect(page.getByText(/the maximum is 3/)).toBeVisible();
});

test("a typed quantity above the stock is corrected to the stock", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/100");

  const quantity = page.getByRole("textbox", { name: "Quantity" });
  await quantity.fill("99");
  await quantity.press("Enter");

  await expect(quantity).toHaveValue("3");
});

test("an out-of-stock product cannot be bought and explains why (edge case 9)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/9");

  await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  await expect(page.getByText(/out of stock/i).first()).toBeVisible();
  await expect(page.getByText(/available once this item is back in stock/)).toBeVisible();
});

test("a product that no longer exists shows a clear page instead of a crash (edge case 2)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/999");

  await expect(page.getByRole("heading", { name: "This product is no longer available" })).toBeVisible();
  await page.getByRole("link", { name: "Browse all products" }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test("a malformed product id shows the same unavailable page", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/abc");

  await expect(page.getByRole("heading", { name: "This product is no longer available" })).toBeVisible();
});

test("the delivery block validates the PIN code and shows a simulated estimate", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");

  await page.getByLabel("PIN code").fill("123");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Enter a valid 6-digit PIN code.")).toBeVisible();

  await page.getByLabel("PIN code").fill("110001");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/Estimated delivery:/)).toBeVisible();
  await expect(page.getByText("Simulated estimate for this demo.")).toBeVisible();
  await expect(page.getByText("30 days return policy")).toBeVisible();
});

test("description and specification tabs work with the keyboard", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");

  await expect(page.getByRole("tab", { name: "Description" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Description 1")).toBeVisible();

  await page.getByRole("tab", { name: "Description" }).focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("tab", { name: "Specifications" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("SKU-1")).toBeVisible();
});

test("the page shows real recommendation rails, each saying what it is based on", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");

  const similar = page.getByRole("region", { name: "Similar Products" });
  await expect(similar).toBeVisible();
  await expect(similar.getByRole("heading", { level: 3 }).first()).toBeVisible();
  await expect(similar.getByRole("heading", { name: "Test Product 1", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "More in Mens Shoes" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Popular Right Now" }).or(page.getByRole("region", { name: "Recommended For You" }))).toBeVisible();
});

test("Add to Cart confirms, updates the header count, and links to the cart", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/1");

  await page.getByRole("button", { name: "Add to Cart" }).click();

  await expect(page.getByText("Added to your cart.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
});

test("a product service failure shows a retry state that recovers (PRD section 16)", async ({ page }) => {
  const api = await mockDummyJson(page);
  api.failProduct = true;
  await page.goto("/products/1");

  await expect(page.getByRole("alert").filter({ hasText: "You appear to be offline" })).toBeVisible({ timeout: 15_000 });

  api.failProduct = false;
  await page.getByRole("button", { name: "Try again" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Test Product 1" })).toBeVisible();
});

for (const { name, width, height } of [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "large desktop", width: 2200, height: 1200 },
]) {
  test(`the product page is usable at ${name} width without horizontal scrolling`, async ({ page }) => {
    await mockDummyJson(page);
    await page.setViewportSize({ width, height });
    await page.goto("/products/1");

    await expect(page.getByRole("heading", { level: 1, name: "Test Product 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to Cart" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Similar Products" }),
    ).toBeAttached();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
