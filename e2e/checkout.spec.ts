import { expect, test } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";
import { CUSTOMER } from "./fixtures";
import { addToCart, completeCustomerStep, completeNewAddressStep, expiredSessionToken, payWithTestCard, reachPaymentStep, signIn } from "./helpers";

test("a signed-in customer can check out through all six steps and see the order confirmed", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1); // ₹3,400
  await page.goto("/checkout");

  // 1. Customer (name and email are filled in from the account)
  await expect(page.getByLabel("Full name")).toHaveValue("Demo Customer");
  await completeCustomerStep(page);

  // 2. Address: use the demo customer's saved address
  await page.getByRole("radio", { name: /Home/ }).click();
  await expect(page.getByLabel("City")).toHaveValue("New Delhi");
  await page.getByRole("button", { name: "Continue to delivery" }).click();

  // 3. Delivery: express costs ₹149
  await page.getByRole("radio", { name: /Express delivery/ }).click();
  await expect(page.getByRole("radio", { name: /Express delivery/ })).toBeChecked();
  await expect(page.getByTestId("checkout-total")).toContainText("₹4,161");
  await page.getByRole("button", { name: "Continue to summary" }).click();

  // 4. Summary
  await expect(page.getByRole("list", { name: "Items in your order" })).toContainText("Test Product 1");
  await page.getByRole("button", { name: "Continue to payment" }).click();

  // 5. Payment (test mode)
  await payWithTestCard(page, "approve");

  // 6. Confirmation
  await expect(page).toHaveURL(/\/checkout\/confirmation\/SS-\d{8}-[A-Z0-9]{5}$/);
  await expect(page.getByRole("heading", { name: "Thank you, your order is placed" })).toBeVisible();
  await expect(page.getByTestId("order-total")).toContainText("₹4,161");
  await expect(page.getByText("Mock Card (test mode)")).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, 0 items" })).toBeVisible();

  const orderId = (await page.getByTestId("confirmation-order-id").textContent()) ?? "";

  // The confirmation survives a refresh (it is read from the saved order).
  await page.reload();
  await expect(page.getByTestId("confirmation-order-id")).toHaveText(orderId);

  // The order is the newest one in the history, at "Order Placed".
  await page.getByRole("link", { name: "Track this order" }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
  await expect(page.getByRole("heading", { level: 1, name: `Order ${orderId}` })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Order Placed" }).first()).toHaveAttribute("data-state", "current");
});

test("the step forms explain every problem and do not move on until it is fixed", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1);
  await page.goto("/checkout");

  await page.getByRole("button", { name: "Continue to address" }).click();
  await expect(page.getByText("Enter your mobile number.")).toBeVisible();
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: "Continue to address" }).click();
  await expect(page.getByText("Enter a valid 10-digit mobile number.")).toBeVisible();
  await completeCustomerStep(page);

  await page.getByRole("radio", { name: /Use a new address/ }).click();
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await expect(page.getByText("Enter your street address.")).toBeVisible();
  await expect(page.getByText("Enter your PIN code.")).toBeVisible();
  await page.getByLabel("Street address").fill("12 Demo Street");
  await page.getByLabel("City").fill("New Delhi");
  await page.getByLabel("State").fill("Delhi");
  await page.getByLabel("PIN code").fill("1100");
  await page.getByRole("button", { name: "Continue to delivery" }).click();
  await expect(page.getByText("Enter a valid 6-digit PIN code.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delivery address" })).toBeVisible();
});

test("the payment step is clearly test mode and has no card, CVV, bank or UPI PIN fields (PRD 5.6)", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1);
  await reachPaymentStep(page);

  await expect(page.getByRole("note")).toContainText("Test mode");
  await page.getByRole("radio", { name: /Mock Card/ }).click();
  await page.getByRole("radio", { name: /Mock UPI/ }).click();

  const types = await page.locator("main form input").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).type));
  expect(types.length).toBeGreaterThan(0);
  expect(types.every((type) => type === "radio" || type === "checkbox")).toBe(true);
  // The banner says what is NOT asked for; check the form's own labels.
  const labels = await page.locator("main form label").allTextContents();
  expect(labels.join(" ")).not.toMatch(/card number|cvv|cvc|expiry|upi id|upi pin|net ?banking|bank login|password/i);
});

test("a declined test payment keeps everything and can be retried (PRD edge case 14)", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1);
  await reachPaymentStep(page);

  await payWithTestCard(page, "decline");

  await expect(page.getByRole("alert").filter({ hasText: "Payment failed." })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Payment failed." })).toContainText("No money was taken.");
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);

  // Earlier steps still hold their data.
  await page.getByRole("navigation", { name: "Checkout progress" }).getByRole("button", { name: /Customer/ }).click();
  await expect(page.getByLabel("Mobile number")).toHaveValue("9876543210");
  await page.getByRole("navigation", { name: "Checkout progress" }).getByRole("button", { name: /Payment/ }).click();

  // Retry and succeed.
  await page.getByRole("button", { name: "Try payment again" }).click();
  await page.getByRole("radio", { name: /Approve the payment/ }).click();
  await page.getByRole("button", { name: /Place order \(test mode\)/ }).click();
  await expect(page).toHaveURL(/\/checkout\/confirmation\//);
});

test("Cash on Delivery is refused above its limit with a clear message", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 11); // a ₹1,02,000 laptop
  await reachPaymentStep(page);

  await page.getByRole("radio", { name: /Mock Cash on Delivery/ }).click();
  await page.getByRole("checkbox", { name: /I understand this is a simulated test payment/ }).check();
  await page.getByRole("button", { name: /Place order \(test mode\)/ }).click();

  await expect(page.getByText(/Cash on Delivery is not available for orders above ₹50,000/)).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("a refresh mid-checkout returns to the same step with the entered data (MOD-06-002)", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1);
  await page.goto("/checkout");
  await completeCustomerStep(page, "9123456780");
  await page.getByRole("radio", { name: /Use a new address/ }).click();
  await page.getByLabel("Street address").fill("77 Refresh Road");

  await page.reload();

  await expect(page.getByRole("heading", { name: "Delivery address" })).toBeVisible();
  await expect(page.getByLabel("Street address")).toHaveValue("77 Refresh Road");
  await page.getByRole("navigation", { name: "Checkout progress" }).getByRole("button", { name: /Customer/ }).click();
  await expect(page.getByLabel("Mobile number")).toHaveValue("9123456780");
});

test("when the session expires on the payment step, progress is kept and restored after signing in (MOD-06-001)", async ({
  page,
  context,
}) => {
  await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1);
  await reachPaymentStep(page);
  await page.getByRole("radio", { name: /Mock UPI/ }).click();
  await page.getByRole("radio", { name: /Approve the payment/ }).click();

  // Another tab writes an expired session, as if the 30 minutes ran out.
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate((token) => localStorage.setItem("shopsphere.auth.session", token), expiredSessionToken());

  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout$/);
  const notice = page.getByRole("status").filter({ hasText: "Your session expired." });
  await expect(notice).toContainText("Sign in again to continue.");
  await expect(notice).toContainText("Your checkout progress is saved and will be restored.");

  await page.getByLabel("Email").fill(CUSTOMER.email);
  await page.getByLabel("Password", { exact: true }).fill(CUSTOMER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: "Payment", exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Mock UPI/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /Approve the payment/ })).toBeChecked();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
});

test("an empty cart has nothing to check out", async ({ page }) => {
  await mockDummyJson(page);
  await signIn(page);

  await page.goto("/checkout");

  await expect(page.getByRole("heading", { name: "There is nothing to check out" })).toBeVisible();
});

test("a cart with a sold-out item sends the customer back to fix it (PRD 5.5)", async ({ page }) => {
  const api = await mockDummyJson(page);
  await signIn(page);
  await addToCart(page, 1);
  api.overrides.stock[1] = 0;

  await page.goto("/checkout");

  await expect(page.getByRole("heading", { name: "Review your cart before checking out" })).toBeVisible();
  await expect(page.getByText("Test Product 1 is out of stock.")).toBeVisible();
  await page.getByRole("link", { name: "Go to your cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
});

test("checkout is usable at mobile width without horizontal scrolling", async ({ page }) => {
  await mockDummyJson(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await signIn(page);
  await addToCart(page, 1);
  await page.goto("/checkout");
  await completeCustomerStep(page);
  await completeNewAddressStep(page);

  await expect(page.getByRole("heading", { name: "Delivery method" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
