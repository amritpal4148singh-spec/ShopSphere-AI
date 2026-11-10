
import { expect, type Page } from "@playwright/test";

import { encodeToken } from "../src/lib/mock-token";
import { CUSTOMER } from "./fixtures";

export async function signIn(
  page: Page,
  account: { email: string; password: string } = CUSTOMER,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  const signOutButton = page.getByRole("button", { name: "Sign out" });

  // Wait for login to finish before checking the navigation.
  await expect(page).toHaveURL(/\/(?!login(?:\?|$))/);

  // On mobile, the navigation may be collapsed inside the menu.
  if (!(await signOutButton.isVisible().catch(() => false))) {
    const openMenu = page.getByRole("button", { name: "Open menu" });

    if (await openMenu.isVisible().catch(() => false)) {
      await openMenu.click();
    }
  }

  await expect(signOutButton).toBeVisible();
}

export async function addToCart(page: Page, productId: number) {
  await page.goto(`/products/${productId}`);
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByText("Added to your cart.")).toBeVisible();
}

/**
 * Session token for the demo customer that has already expired,
 * as if the 30-minute session ran out.
 */
export function expiredSessionToken(): string {
  const now = Math.floor(Date.now() / 1000);

  return encodeToken({
    sub: "user-seed-customer",
    name: "Demo Customer",
    email: "customer@shopsphere.test",
    role: "customer",
    iat: now - 3600,
    exp: now - 60,
  });
}

export async function completeCustomerStep(
  page: Page,
  phone = "9876543210",
) {
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Continue to address" }).click();
  await expect(
    page.getByRole("heading", { name: "Delivery address" }),
  ).toBeVisible();
}

export async function completeNewAddressStep(page: Page) {
  // The demo customer has a saved address; choose to enter a new one.
  const newAddress = page.getByRole("radio", {
    name: /Use a new address/,
  });

  if (await newAddress.count()) {
    await newAddress.click();
  }

  await page.getByLabel("Street address").fill("12 Demo Street");
  await page.getByLabel("City").fill("New Delhi");
  await page.getByLabel("State").fill("Delhi");
  await page.getByLabel("PIN code").fill("110001");
  await page.getByRole("button", { name: "Continue to delivery" }).click();

  await expect(
    page.getByRole("heading", { name: "Delivery method" }),
  ).toBeVisible();
}

export async function reachPaymentStep(page: Page) {
  await page.goto("/checkout");
  await completeCustomerStep(page);
  await completeNewAddressStep(page);
  await page.getByRole("button", { name: "Continue to summary" }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(
    page.getByRole("heading", { name: "Payment", exact: true }),
  ).toBeVisible();
}

export async function payWithTestCard(
  page: Page,
  outcome: "approve" | "decline",
) {
  await page.getByRole("radio", { name: /Mock Card/ }).click();

  await page
    .getByRole("radio", {
      name: outcome === "approve" ? /Approve the payment/ : /Decline the payment/,
    })
    .click();

  await page
    .getByRole("checkbox", {
      name: /I understand this is a simulated test payment/,
    })
    .check();

  await page
    .getByRole("button", {
      name: /Place order.*test mode/i,
    })
    .click();
}
