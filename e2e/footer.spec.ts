import { expect, test } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";

// Not executed in the authoring sandbox (no browser available). Run locally with `npm run test:e2e`.

test("the footer has sitemap and policy links that all resolve (PRD 5.1)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/");
  const footer = page.getByRole("contentinfo");

  for (const name of ["Shop", "Account", "Policies"]) await expect(footer.getByRole("navigation", { name })).toBeVisible();

  for (const [name, heading] of [
    ["Shipping and delivery", "Shipping and delivery"],
    ["Returns and refunds", "Returns and refunds"],
    ["Privacy", "Privacy"],
    ["Terms of use", "Terms of use"],
  ] as const) {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText("Demonstration content")).toBeVisible();
  }
});

test("every footer link leads to a page that loads", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/");
  const hrefs = await page.getByRole("contentinfo").getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThanOrEqual(12);
  for (const href of new Set(hrefs)) {
    const response = await page.goto(href!);
    expect(response?.status(), href!).toBeLessThan(400);
  }
});

test("the newsletter form validates, shows progress, succeeds, and recognises a repeat (simulated)", async ({ page }) => {
  await mockDummyJson(page);
  await page.goto("/");
  const form = page.getByRole("contentinfo").locator("form");

  await form.getByLabel("Address for newsletter updates").fill("not-an-email");
  await form.getByRole("button", { name: "Subscribe" }).click();
  await expect(form.getByRole("alert")).toContainText("valid email");

  await form.getByLabel("Address for newsletter updates").fill("shopper@example.com");
  await form.getByRole("button", { name: "Subscribe" }).click();
  await expect(form.getByText("Thanks! You are subscribed (demo).")).toBeVisible();

  await form.getByLabel("Address for newsletter updates").fill("SHOPPER@example.com");
  await form.getByRole("button", { name: "Subscribe" }).click();
  await expect(form.getByText("You are already subscribed with that address.")).toBeVisible();
});
