
import { expect, test } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";

// Not executed in the authoring sandbox (no browser available). Run locally with `npm run test:e2e`.
// Checks the PRD 15 breakpoints on the key pages: no sideways page scroll, and the layout adapts as specified.

const WIDTHS = [375, 640, 768, 1024, 1280, 1440, 1920];
const PAGES = ["/", "/products", "/search?q=Test", "/cart", "/wishlist", "/compare", "/policies/privacy", "/login"];

for (const width of WIDTHS) {
  test(`no page scrolls sideways at ${width}px`, async ({ page }) => {
    await mockDummyJson(page);
    await page.setViewportSize({ width, height: 900 });

    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );

      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}

test("below 1024px the filters open as a bottom sheet; from 1024px they are a sidebar (PRD 15)", async ({ page }) => {
  await mockDummyJson(page);

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/products");

  await expect(page.getByRole("complementary")).toHaveCount(0);

  await page.getByRole("button", { name: "Filters", exact: true }).click();

  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();

  // The checkbox follows the URL, which updates a moment after the click, so click and then wait for the state.
  await sheet.getByRole("checkbox", { name: /On sale/ }).click();
  await expect(sheet.getByRole("checkbox", { name: /On sale/ })).toBeChecked();

  await sheet.getByRole("button", { name: /^Show \d+ products?$/ }).click();
  await expect(sheet).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });

  await expect(
    page.getByRole("button", { name: "Filters", exact: true })
  ).toBeHidden();

  await expect(page.locator("#filter-panel")).toBeVisible();
});

test("the grid uses 2 columns on a phone and more on wider screens", async ({ page }) => {
  await mockDummyJson(page);

  // Product titles are the h3 of each card; the number of distinct left edges is the number of columns.
  const columns = () =>
    page.locator("main h3").evaluateAll(
      (titles) =>
        new Set(
          titles.slice(0, 12).map((title) =>
            Math.round(title.getBoundingClientRect().left)
          )
        ).size
    );

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/products");
  await expect(page.locator("main h3").first()).toBeVisible();

  expect(await columns()).toBe(2);

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await columns()).toBeGreaterThanOrEqual(3);
});

test("a phone shows the bottom cart shortcut beside the assistant, and wider screens do not", async ({ page }) => {
  await mockDummyJson(page);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/products");

  await expect(page.getByRole("link", { name: /^Shopping bag, \d+ items?$/ })).toBeVisible();

  await page.setViewportSize({ width: 768, height: 900 });
  await expect(page.getByRole("link", { name: /^Shopping bag, \d+ items?$/ })).toBeHidden();
});
