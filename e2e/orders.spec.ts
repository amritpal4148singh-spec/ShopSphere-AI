import { expect, test } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";
import { signIn } from "./helpers";

const STATUSES = ["Order Placed", "Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"];

test("the demo customer's order history has one sample order for every tracking status, newest first", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);

  await page.getByRole("link", { name: "Orders", exact: true }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Your orders" })).toBeVisible();
  const orders = page.getByRole("list").filter({ has: page.getByRole("link", { name: /SS-DEMO/ }) }).getByRole("link");
  await expect(orders).toHaveCount(6);
  await expect(orders.first()).toContainText("SS-DEMO-0006");
  await expect(orders.last()).toContainText("SS-DEMO-0001");
  for (const status of STATUSES) await expect(page.getByText(status, { exact: true })).toBeVisible();
});

test("an in-progress order shows completed stages with times, the current stage, and upcoming stages (MOD-08-001)", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await page.goto("/orders");

  await page.getByRole("link", { name: /SS-DEMO-0003/ }).click(); // Shipped

  await expect(page.getByRole("heading", { level: 1, name: "Order SS-DEMO-0003" })).toBeVisible();
  const stages = page.getByRole("list", { name: "Order tracking" }).getByRole("listitem");
  await expect(stages).toHaveCount(6);
  await expect(stages.nth(0)).toHaveAttribute("data-state", "completed");
  await expect(stages.nth(1)).toHaveAttribute("data-state", "completed");
  await expect(stages.nth(2)).toHaveAttribute("data-state", "completed");
  await expect(stages.nth(3)).toHaveAttribute("data-state", "current");
  await expect(stages.nth(3)).toHaveAttribute("aria-current", "step");
  await expect(stages.nth(4)).toHaveAttribute("data-state", "upcoming");
  await expect(stages.nth(5)).toHaveAttribute("data-state", "upcoming");

  await expect(stages.nth(3)).toContainText("Shipped");
  await expect(stages.nth(3)).not.toContainText("Upcoming");
  await expect(stages.nth(4)).toContainText("Upcoming");
  await expect(stages.nth(0)).toContainText(/\d{4}/);
});

test("a delivered order shows every stage completed", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await page.goto("/orders/SS-DEMO-0001");

  await expect(page.locator('li[data-state="completed"]')).toHaveCount(6);
  await expect(page.locator('li[data-state="upcoming"]')).toHaveCount(0);
});

test("an order shows its items, address, delivery, test-mode payment and totals", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await page.goto("/orders/SS-DEMO-0001");

  await expect(page.getByRole("list", { name: "Items in this order" })).toContainText("Calvin Klein CK One");
  await expect(page.getByText("12 Demo Street", { exact: false })).toBeVisible();
  await expect(page.getByText("Mock Card (test mode)")).toBeVisible();
  await expect(page.getByTestId("order-total")).toContainText("₹");
  await expect(page.getByText(/Tracking is simulated for this demo/)).toBeVisible();
});

test("an unknown order number shows a clear not-found page", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await page.goto("/orders/SS-NOT-REAL");

  await expect(page.getByRole("heading", { name: "Order not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go to your orders" }).click();
  await expect(page).toHaveURL(/\/orders$/);
});

test("a brand-new customer sees a helpful empty order history (edge case 13)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/register");
  await page.getByLabel("Name").fill("New Shopper");
  await page.getByLabel("Email").fill(`new-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Password123");
  await page.getByLabel("Confirm password").fill("Password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.goto("/orders");

  await expect(page.getByRole("heading", { name: "You have no orders yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start shopping" })).toBeVisible();
});

test("signed-out visitors cannot see orders", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/orders/SS-DEMO-0001");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("order history is usable at mobile width without horizontal scrolling", async ({ page }) => {
  await mockDummyJson(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  await page.goto("/orders/SS-DEMO-0003");

  await expect(page.getByRole("list", { name: "Order tracking" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
