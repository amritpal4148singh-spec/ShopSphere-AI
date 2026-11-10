import { expect, test, type Page } from "@playwright/test";

import { ADMIN, CUSTOMER } from "./fixtures";

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("unauthenticated visitors are redirected to login, return after sign-in, and stay signed in after a refresh", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);

  await signIn(page, CUSTOMER);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Signed in as Demo Customer/)).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Signed in as Demo Customer/)).toBeVisible();
});

test("every protected route redirects an unauthenticated visitor to login", async ({ page }) => {
  for (const path of ["/checkout", "/orders", "/dashboard", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
  }
});

test("invalid credentials mark the exact field that failed", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(CUSTOMER.email);
  await page.getByLabel("Password", { exact: true }).fill("Wrong12345");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/Incorrect password/)).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email")).not.toHaveAttribute("aria-invalid", "true");
});

test("a customer cannot reach the admin area and sees no admin entry point", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, CUSTOMER);
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "You do not have access to this page" })).toBeVisible();
});


test("an administrator sees the admin entry point and can open the admin area", async ({
  page,
}) => {
  await page.goto("/login");
  await signIn(page, ADMIN);

  // Confirm successful login using elements actually present on the page.
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: "Sign out" }),
  ).toBeVisible();

  const adminLink = page.getByRole("link", {
    name: "Admin",
    exact: true,
  });

  await expect(adminLink).toBeVisible();
  await adminLink.click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Admin" }),
  ).toBeVisible();

  // Verify the authenticated session is still available in the admin area.
  await expect(
    page.getByRole("button", { name: "Sign out" }),
  ).toBeVisible();
});


test("a visitor can register, is signed in, and can sign out", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Asha Rao");
  await page.getByLabel("Email").fill(`asha-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("Password123");
  await page.getByLabel("Confirm password").fill("Password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
