import { expect, test } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";

test("home page renders the app shell without console errors", async ({ page }) => {
  await mockDummyJson(page);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "ShopSphere AI" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  expect(errors).toEqual([]);
});
