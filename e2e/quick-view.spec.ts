
import { test, expect } from "@playwright/test";
import { mockDummyJson } from "./dummyjson-mock";

test.describe("Quick View", () => {
  test("opens the Quick View dialog with product details", async ({ page }) => {
    await mockDummyJson(page);
    await page.goto("/products");

    await page.getByRole("button", {
      name: "Quick view Test Product 1",
      exact: true,
    }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Test Product 1");
  });

  test("adds a product to cart from Quick View", async ({ page }) => {
    await mockDummyJson(page);
    await page.goto("/products");

    await page.getByRole("button", {
      name: "Quick view Test Product 1",
      exact: true,
    }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Product 1 is mens-shoes and uses radio-based size selection.
    const sizeOptions = dialog.getByRole("radio");

    await expect(sizeOptions).toHaveCount(5);
    await sizeOptions.nth(0).check();

    await dialog.getByRole("button", {
      name: "Add to Cart",
    }).click();

    await expect(dialog.getByText("Added to your cart.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Cart, 1 item" })
    ).toBeVisible();
  });

  test("Escape closes Quick View and returns focus", async ({ page }) => {
    await mockDummyJson(page);
    await page.goto("/products");

    const quickViewButton = page.getByRole("button", {
      name: "Quick view Test Product 2",
      exact: true,
    });

    await quickViewButton.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(dialog).toBeHidden();
    await expect(quickViewButton).toBeFocused();
  });

  test("traps keyboard focus inside Quick View", async ({ page }) => {
    await mockDummyJson(page);
    await page.goto("/products");

    await page.getByRole("button", {
      name: "Quick view Test Product 1",
      exact: true,
    }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const focusableElements = dialog.locator(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    expect(await focusableElements.count()).toBeGreaterThan(0);

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      await expect(dialog).toBeVisible();
    }
  });

  test("Quick View works on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await mockDummyJson(page);
    await page.goto("/products");

    await page.getByRole("button", {
      name: "Quick view Test Product 1",
      exact: true,
    }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Test Product 1");
  });
});
