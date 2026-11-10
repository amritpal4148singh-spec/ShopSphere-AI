import { expect, test } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";
import { signIn } from "./helpers";

// Not executed in the authoring sandbox (no browser available). Run locally with `npm run test:e2e`.

test("profile edits are validated, saved, and survive a reload (PRD 5.7)", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await page.goto("/dashboard");

  const profile = page.getByRole("region", { name: "Profile" });
  await profile.getByLabel("Full name").fill("Demo Customer Renamed");
  await profile.getByLabel("Mobile number (optional)").fill("123");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(profile.getByText("Enter a valid 10-digit mobile number.")).toBeVisible();

  await profile.getByLabel("Mobile number (optional)").fill("9876543210");
  await profile.getByRole("button", { name: "Save profile" }).click();
  await expect(profile.getByText("Profile saved on this device.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Profile" }).getByLabel("Full name")).toHaveValue("Demo Customer Renamed");
  await expect(page.getByText(/Signed in as Demo Customer Renamed/)).toBeVisible();
});

test("addresses can be added, edited, made default and deleted, and the default is pre-selected at checkout", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await page.goto("/dashboard");

  const addresses = page.getByRole("region", { name: "Addresses" });
  await expect(addresses.getByTestId("saved-address")).toHaveCount(1); // the seeded Home address

  await addresses.getByRole("button", { name: "Add address" }).click();
  await addresses.getByLabel("Label (optional)").fill("Office");
  await addresses.getByLabel("Street address").fill("9 Lake View Road");
  await addresses.getByLabel("City").fill("Pune");
  await addresses.getByLabel("State").fill("Maharashtra");
  await addresses.getByLabel("PIN code").fill("411001");
  await addresses.getByRole("button", { name: "Save address" }).click();
  await expect(addresses.getByTestId("saved-address")).toHaveCount(2);

  await addresses.getByRole("button", { name: "Make Office the default address" }).click();
  await expect(addresses.getByTestId("saved-address").first()).toContainText("Office");
  await expect(addresses.getByTestId("saved-address").first()).toContainText("Default");

  await addresses.getByRole("button", { name: "Edit Office" }).click();
  await addresses.getByLabel("City").fill("Mumbai");
  await addresses.getByRole("button", { name: "Save changes" }).click();
  await expect(addresses.getByText(/Mumbai/)).toBeVisible();

  await addresses.getByRole("button", { name: "Delete Home" }).click();
  await addresses.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(addresses.getByTestId("saved-address")).toHaveCount(1);
});

test("a review the customer wrote appears under My reviews and can be edited and deleted", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await page.goto("/products/1");

  await page.locator('label:has(input[aria-label="5 stars"])').click();
  await page.getByLabel("Your review").fill("Comfortable, sturdy and exactly as described.");
  await page.getByRole("button", { name: "Submit review" }).click();
  // Wait for the save to finish before leaving the page, as the existing reviews spec does.
  await expect(page.getByText("Thank you. Your review was saved on this device.")).toBeVisible();

  await page.goto("/dashboard");
  const mine = page.getByRole("region", { name: "My reviews" });
  await expect(mine.getByTestId("my-review")).toHaveCount(1);
  await expect(mine.getByTestId("my-review")).toContainText("Comfortable, sturdy");

  await mine.getByRole("button", { name: /Delete your review/ }).click();
  await mine.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(mine.getByText("You have not written any reviews yet")).toBeVisible();
});

test("Recently viewed lists the full history, newest first", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  for (const id of [1, 2, 3]) {
    await page.goto(`/products/${id}`);
    // A view is recorded once the product has loaded, so wait for it before moving on.
    await expect(page.getByRole("heading", { level: 1, name: `Test Product ${id}` })).toBeVisible();
  }
  await page.goto("/dashboard");

  const recent = page.getByRole("region", { name: "Recently viewed" });
  await expect(recent.getByRole("heading", { level: 3 })).toHaveText(["Test Product 3", "Test Product 2", "Test Product 1"]);
});
