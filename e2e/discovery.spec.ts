
import { expect, test, type Page } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";

const cardTitles = (page: Page) =>
  page.getByRole("heading", { level: 3 }).allTextContents();

test("browsing shows the product grid with a count and pagination", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products");

  await expect(page.getByText("30 products")).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(24);

  await page.getByRole("button", { name: "Page 2" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(6);
});

test("combined category, price, rating and sort filters update the grid, chips and count (MOD-02-001)", async ({
  page,
}) => {
  await mockDummyJson(page);
  await page.goto("/products?category=mens-shoes&category=womens-shoes");

  await expect(page.getByText("6 products")).toBeVisible();

  await page.getByLabel("Minimum price").fill("2000");
  await page.getByLabel("Maximum price").fill("5000");

  // Wait for price filters to finish updating the URL before changing rating.
  await expect(page).toHaveURL(/minPrice=2000/);
  await expect(page).toHaveURL(/maxPrice=5000/);

  const rating = page.getByRole("radio", {
    name: "4 stars and up",
  });

  await rating.click();

  await expect(page).toHaveURL(/rating=4/);
  await expect(rating).toBeChecked();

  await page.getByLabel("Sort by").selectOption("price-asc");

  await expect(page).toHaveURL(/minPrice=2000/);
  await expect(page).toHaveURL(/maxPrice=5000/);
  await expect(page).toHaveURL(/rating=4/);
  await expect(page).toHaveURL(/sort=price-asc/);

  await expect(page.getByText("3 products")).toBeVisible();

  expect(await cardTitles(page)).toEqual([
    "Test Product 1",
    "Test Product 5",
    "Test Product 2",
  ]);

  const chips = page.getByRole("list", {
    name: "Active filters",
  });

  await expect(
    chips.getByRole("button", {
      name: "Remove filter: Mens Shoes",
    }),
  ).toBeVisible();

  await expect(
    chips.getByRole("button", {
      name: "Remove filter: Womens Shoes",
    }),
  ).toBeVisible();

  await expect(
    chips.getByRole("button", {
      name: /Remove filter: ₹2,000 to ₹5,000/,
    }),
  ).toBeVisible();

  await expect(
    chips.getByRole("button", {
      name: "Remove filter: 4 stars and up",
    }),
  ).toBeVisible();
});

test("a filter combination with no matches names the filters and clears in one click (MOD-02-002)", async ({
  page,
}) => {
  await mockDummyJson(page);
  await page.goto("/products?rating=5");

  await expect(
    page.getByRole("heading", {
      name: "No products match your filters",
    }),
  ).toBeVisible();

  await expect(
    page
      .getByRole("list", { name: "Filters with no results" })
      .getByText("5 stars and up"),
  ).toBeVisible();

  await page
    .getByRole("button", {
      name: "Clear Filters",
      exact: true,
    })
    .click();

  await expect(page).not.toHaveURL(/rating=/);
  await expect(page.getByText("30 products")).toBeVisible();
});

test("a reversed price range in the URL is corrected instead of breaking the page (edge case 7)", async ({
  page,
}) => {
  await mockDummyJson(page);
  await page.goto(
    "/products?minPrice=5000&maxPrice=2000&category=mens-shoes",
  );

  await expect(
    page.getByRole("button", {
      name: /Remove filter: ₹2,000 to ₹5,000/,
    }),
  ).toBeVisible();

  await expect(page.getByText("2 products")).toBeVisible();
});

test("category pages show only that category", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/category/smartphones");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Smartphones",
    }),
  ).toBeVisible();

  await expect(page.getByText("3 products")).toBeVisible();

  expect(
    (await cardTitles(page)).every((title) =>
      title.startsWith("Test Phone"),
    ),
  ).toBe(true);
});

test("search suggestions wait for typing to pause, then one request fires (MOD-03-001)", async ({
  page,
}) => {
  const api = await mockDummyJson(page);
  await page.goto("/");

  const box = page.getByRole("combobox", {
    name: "Search products",
  });

  await box.click();
  await box.pressSequentially("phone", { delay: 30 });

  expect(api.requests.suggestions).toHaveLength(0);

  await expect(
    page.getByRole("option", {
      name: /Test Phone Seven/,
    }),
  ).toBeVisible();

  expect(api.requests.suggestions).toEqual(["phone"]);
});

test("searching updates the URL, shows results, and supports back and forward", async ({
  page,
}) => {
  await mockDummyJson(page);
  await page.goto("/");

  const box = page.getByRole("combobox", {
    name: "Search products",
  });

  await box.fill("phone");
  await box.press("Enter");

  await expect(page).toHaveURL(/\/search\?q=phone/);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Results for “phone”",
    }),
  ).toBeVisible();

  await expect(page.getByText("3 products")).toBeVisible();

  await box.fill("laptop");
  await box.press("Enter");

  await expect(page).toHaveURL(/q=laptop/);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Results for “laptop”",
    }),
  ).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(/q=phone/);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Results for “phone”",
    }),
  ).toBeVisible();

  await expect(box).toHaveValue("phone");

  await page.reload();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Results for “phone”",
    }),
  ).toBeVisible();
});

test("a search with no results offers alternatives (edge case 6)", async ({
  page,
}) => {
  await mockDummyJson(page);
  await page.goto("/search?q=laptp");

  await expect(
    page.getByRole("heading", {
      name: "No results for “laptp”",
    }),
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Laptops" }),
  ).toBeVisible();
});

test("submitting an empty search fires no request and shows recent and popular searches (edge case 5)", async ({
  page,
}) => {
  const api = await mockDummyJson(page);
  await page.goto("/");

  const box = page.getByRole("combobox", {
    name: "Search products",
  });

  await box.click();
  await box.press("Enter");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Popular searches")).toBeVisible();

  expect(api.requests.search).toHaveLength(0);
  expect(api.requests.suggestions).toHaveLength(0);
});

test("recent searches are remembered and can be cleared", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/");

  const box = page.getByRole("combobox", {
    name: "Search products",
  });

  await box.fill("laptops");
  await box.press("Enter");

  await expect(page).toHaveURL(/q=laptops/);

  await page.goto("/search");

  await expect(
    page.getByRole("link", { name: "laptops" }).first(),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Recent searches" }),
  ).toBeVisible();

  await page.getByRole("button", {
    name: "Clear history",
  }).click();

  await expect(
    page.getByRole("heading", { name: "Recent searches" }),
  ).toHaveCount(0);
});

test("a product service failure shows a retry state that recovers (PRD section 16)", async ({
  page,
}) => {
  const api = await mockDummyJson(page);
  api.failProducts = true;

  await page.goto("/products");

  // Next.js adds its own empty route-announcer alert.
  // Match the specific error message instead.
  await expect(
    page.getByRole("alert").filter({
      hasText: "You appear to be offline",
    }),
  ).toBeVisible({ timeout: 15_000 });

  api.failProducts = false;

  await page.getByRole("button", {
    name: "Try again",
  }).click();

  await expect(page.getByText("30 products")).toBeVisible();
});
