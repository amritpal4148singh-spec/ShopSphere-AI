
import { expect, test } from "@playwright/test";
import { mockDummyJson } from "./dummyjson-mock";

const tray = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Product comparison" });

test("selecting products fills the tray, and Compare now opens a side-by-side table (PRD 5.2)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products");

  await page.getByRole("button", { name: "Compare Test Product 1", exact: true }).click();
  await expect(tray(page)).toContainText("Compare (1/4)");
  await expect(tray(page).getByRole("button", { name: "Compare now" })).toBeDisabled();

  await page.getByRole("button", { name: "Compare Test Product 2", exact: true }).click();
  await expect(tray(page)).toContainText("Compare (2/4)");

  // Prevent the floating assistant from intercepting this test click.
  await page.addStyleTag({
    content: `
      button[aria-label="Open shopping assistant"] {
        display: none !important;
      }
    `,
  });

  await tray(page).getByRole("button", { name: "Compare now" }).click();

  await expect(page).toHaveURL(/compare$/);
  await expect(page.getByRole("heading", { level: 1, name: "Compare products" })).toBeVisible();

  const table = page.getByRole("table");
  await expect(table.getByRole("columnheader", { name: /Test Product 1/ })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: /Test Product 2/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /Price/ })).toContainText("Lowest price");
  await expect(table.getByRole("row", { name: /Price/ })).toContainText("Differs");
});

test("the selection survives a reload and navigation, and a fifth product is refused with an explanation", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products");

  for (const id of [1, 2, 3, 4]) {
    await page.getByRole("button", {
      name: `Compare Test Product ${id}`,
      exact: true,
    }).click();
  }

  await expect(tray(page)).toContainText("Compare (4/4)");

  const fifth = page.getByRole("button", { name: /Comparison is full/ }).first();
  await expect(fifth).toHaveAttribute("aria-disabled", "true");

  await page.reload();
  await expect(tray(page)).toContainText("Compare (4/4)");

  await page.goto("/search?q=Test");
  await expect(tray(page)).toContainText("Compare (4/4)");
});

test("removing products from the tray and from the table works, and fewer than two shows guidance", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/products");

  await page.getByRole("button", { name: "Compare Test Product 1", exact: true }).click();
  await page.getByRole("button", { name: "Compare Test Product 2", exact: true }).click();
  await page.goto("/compare");

  await page.getByRole("button", { name: "Remove Test Product 2 from comparison" }).click();
  await expect(page.getByRole("heading", { name: "Choose one more product" })).toBeVisible();

  await page.getByRole("link", { name: "Browse products" }).click();
  await expect(page).toHaveURL(/products$/);
  await expect(tray(page)).toContainText("Compare (1/4)");

  await tray(page).getByRole("button", { name: "Clear" }).click();
  await expect(tray(page)).toHaveCount(0);
});

test("a compared product without variants can be added to the cart from the table; one with sizes links to its page", async ({ page }) => {
  await mockDummyJson(page);

  // Capture browser console logs for Product 7.
  page.on("console", (msg) => {
    if (msg.text().includes("[COMPARE DEBUG]")) {
      console.log("BROWSER:", msg.text());
    }
  });

  // Capture browser errors too.
  page.on("pageerror", (error) => {
    console.log("BROWSER PAGE ERROR:", error.message);
  });

  await page.goto("/products");

  // Product 7 is a smartphone (no variants).
  await page.getByRole("button", {
    name: "Compare Test Phone Seven",
    exact: true,
  }).click();

  // Product 1 is a shoe (size variants).
  await page.getByRole("button", {
    name: "Compare Test Product 1",
    exact: true,
  }).click();

  await page.goto("/compare");

  // Wait for the comparison table and product details.
  await expect(page.getByRole("table")).toBeVisible();

  await expect(
    page.getByRole("columnheader", { name: /Test Phone Seven/ })
  ).toBeVisible();

  // Temporary diagnostics: inspect actual rendered table and action cells.
  await page.waitForTimeout(1500);

  console.log(
    "COMPARE PAGE DEBUG:",
    await page.locator("table").innerText()
  );

  console.log(
    "PRODUCT 7 ACTIONS:",
    await page.locator("tfoot").innerText()
  );

  // Product 7 should have a direct Add to Cart button.
  await expect(
    page.getByRole("button", {
      name: "Add Test Phone Seven to cart",
    })
  ).toBeVisible();

  await page.getByRole("button", {
    name: "Add Test Phone Seven to cart",
  }).click();

  await expect(
    page.getByRole("link", { name: "Cart, 1 item" })
  ).toBeVisible();

  // Product 1 has size variants, so it should not have a direct Add to Cart button.
  await expect(
    page.getByRole("button", {
      name: "Add Test Product 1 to cart",
    })
  ).toHaveCount(0);

  await expect(
    page.getByRole("link", {
      name: "Choose options for Test Product 1",
    })
  ).toHaveAttribute("href", "/products/1");
});

test("the comparison table scrolls inside itself on a phone instead of breaking the page", async ({ page }) => {
  await mockDummyJson(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/products");

  for (const id of [1, 2, 3]) {
    await page.getByRole("button", {
      name: `Compare Test Product ${id}`,
      exact: true,
    }).click();
  }

  await page.goto("/compare");

  await expect(page.getByRole("table")).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
  ).toBeLessThanOrEqual(0);

  await expect(
    page.getByRole("region", { name: /Comparison table/ })
  ).toBeVisible();
});
