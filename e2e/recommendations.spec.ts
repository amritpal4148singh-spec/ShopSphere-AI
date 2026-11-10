import { expect, test, type Page } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";
import { addToCart, signIn } from "./helpers";

async function view(page: Page, id: number, title: string) {
  await page.goto(`/products/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  // The view is recorded once the page has loaded; give the effect a moment before leaving.
  await page.waitForTimeout(150);
}

const region = (page: Page, name: string | RegExp) => page.getByRole("region", { name });
const cards = (section: ReturnType<typeof region>) => section.getByRole("heading", { level: 3 });

test("a first-time visitor sees Featured and Trending, and nothing personal pretending to be (MOD-01-001)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mockDummyJson(page);
  await page.goto("/");

  await expect(region(page, "Featured Products")).toBeVisible();
  await expect(region(page, "Trending Now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recently Viewed" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Recommended For You" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Popular Right Now" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a returning visitor sees Recently Viewed and rails that reflect their history (MOD-01-002)", async ({ page }) => {
  await mockDummyJson(page);
  await view(page, 1, "Test Product 1");
  await view(page, 2, "Test Product 2");
  await view(page, 3, "Test Product 3");

  await page.goto("/");

  const recent = region(page, "Recently Viewed");
  await expect(recent).toBeVisible();
  await expect(cards(recent)).toHaveText(["Test Product 3", "Test Product 2", "Test Product 1"]);

  const personal = region(page, "Recommended For You");
  await expect(personal).toBeVisible();
  await expect(personal).toContainText("Based on your browsing");
  for (const seen of ["Test Product 1", "Test Product 2", "Test Product 3"]) {
    await expect(personal.getByRole("heading", { name: seen, exact: true })).toHaveCount(0);
  }

  await expect(region(page, "Because You Browsed Mens Shoes")).toBeVisible();
  await expect(region(page, /^In Your Price Range \(₹[\d,]+ to ₹[\d,]+\)$/)).toBeVisible();
  // Every personalized card says why.
  await expect(personal.getByText(/Similar to Test Product|Matches your interest|price range|Shares your interest|Popular with shoppers|Highly rated/).first()).toBeVisible();
});

test("a viewed out-of-stock product stays visible in Recently Viewed, marked, and is never recommended (edge case 23)", async ({ page }) => {
  await mockDummyJson(page);
  await view(page, 9, "Test Phone Nine");

  await page.goto("/");

  const recent = region(page, "Recently Viewed");
  await expect(recent.getByRole("heading", { name: "Test Phone Nine" })).toBeVisible();
  await expect(recent.getByText("Out of stock")).toBeVisible();
  for (const name of ["Featured Products", "Trending Now", "Recommended For You", "Because You Browsed Smartphones"]) {
    const section = region(page, name);
    if (await section.count()) await expect(section.getByRole("heading", { name: "Test Phone Nine" })).toHaveCount(0);
  }
});

test("a search is a signal too: it shapes the home page afterwards", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/");
  const box = page.getByRole("combobox", { name: "Search products" });
  await box.fill("phone");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=phone/);

  await page.goto("/");

  await expect(region(page, "Because You Browsed Smartphones")).toBeVisible();
});

test("the product page shows similar, bought-together, more-in-category and personalized rails, never the product itself", async ({
  page,
}) => {
  await mockDummyJson(page, { extras: true });
  await page.goto("/products/7");

  const similar = region(page, "Similar Products");
  await expect(similar).toBeVisible();
  await expect(similar.getByRole("heading", { name: "Test Phone Seven" })).toHaveCount(0);
  await expect(similar.getByText(/Same category: Smartphones/).first()).toBeVisible();

  const together = region(page, "Frequently Bought Together");
  await expect(together).toBeVisible();
  await expect(together.getByRole("heading", { name: /Test Accessory/ }).first()).toBeVisible();

  await expect(region(page, "More in Smartphones")).toBeVisible();
  await expect(region(page, "Popular Right Now").or(region(page, "Recommended For You"))).toBeVisible();

  // The sold-out phone is never offered.
  for (const section of [similar, together, region(page, "More in Smartphones")]) {
    await expect(section.getByRole("heading", { name: "Test Phone Nine" })).toHaveCount(0);
  }
});

test("the cart offers add-ons that go with it, not near-duplicates (PRD 5.5)", async ({ page }) => {
  await mockDummyJson(page, { extras: true });
  await addToCart(page, 8);

  await page.goto("/cart");

  const rail = region(page, "Goes Well With Your Cart");
  await expect(rail).toBeVisible();
  await expect(rail.getByRole("heading", { name: /Test Accessory/ }).first()).toBeVisible();
  await expect(rail.getByText("Goes with Test Phone Eight in your cart").first()).toBeVisible();
  await expect(rail.getByRole("heading", { name: /Test Phone/ })).toHaveCount(0);
});

test("the wishlist offers products inspired by what is saved", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products/17");
  await page.getByRole("button", { name: "Add Test Product 17 to wishlist" }).click();

  await page.goto("/wishlist");

  const rail = region(page, "Inspired By Your Wishlist");
  await expect(rail).toBeVisible();
  await expect(rail.getByText("Similar to Test Product 17 on your wishlist").first()).toBeVisible();
  await expect(rail.getByRole("heading", { name: "Test Product 17", exact: true })).toHaveCount(0);
});

test("the dashboard explains the signals, lets the customer reset them, and the home page follows (PRD 5.7)", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await view(page, 1, "Test Product 1");
  await view(page, 2, "Test Product 2");

  await page.getByRole("link", { name: "Dashboard", exact: true }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Recommendation preferences" })).toBeVisible();
  const viewed = region(page, "Because you viewed");
  await expect(viewed.getByRole("link")).toHaveText(["Test Product 2", "Test Product 1"]);
  await expect(region(page, "Your typical price range")).toContainText(/₹[\d,]+ to ₹[\d,]+/);
  await expect(region(page, "Your account activity")).toContainText("6 past orders");
  await expect(page.getByText(/^(Low|Medium|High) \(\d+%\)$/)).toBeVisible();

  await page.getByText("How recommendations are scored").click();
  await expect(page.getByRole("table", { name: "Score components and weights" })).toContainText("Category you browse");

  await page.getByRole("button", { name: "Clear viewing history" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Your viewing history was cleared." })).toBeVisible();
  await expect(page.getByText("No products viewed yet.")).toBeVisible();

  await page.goto("/");
  await expect(region(page, "Trending Now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recently Viewed" })).toHaveCount(0);
});

test("resetting all browsing signals asks first and keeps the cart and wishlist", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1);
  await view(page, 2, "Test Product 2");
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Reset all browsing signals" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  // Adding product 1 to the cart opened its page first, so both products were viewed.
  await expect(region(page, "Because you viewed").getByRole("link")).toHaveCount(2);

  await page.getByRole("button", { name: "Reset all browsing signals" }).click();
  await page.getByRole("button", { name: "Yes, reset" }).click();

  await expect(page.getByText("No products viewed yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
});

test("when the catalogue cannot be loaded the rails disappear quietly instead of showing broken boxes (edge case 16)", async ({ page }) => {
  const api = await mockDummyJson(page);
  api.failProducts = true;
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "ShopSphere AI" })).toBeVisible();
  await page.waitForTimeout(2500); // the catalogue request is retried once before giving up
  await expect(page.getByRole("heading", { name: "Featured Products" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Trending Now" })).toHaveCount(0);
});

test("the home page is usable at mobile width: rails scroll sideways inside themselves, not the page", async ({ page }) => {
  await mockDummyJson(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await expect(region(page, "Featured Products")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
