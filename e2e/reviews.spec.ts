import { expect, test, type Page } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";
import { ADMIN, CUSTOMER } from "./fixtures";
import { signIn } from "./helpers";

// In the mocked catalogue every product has 3 four-star reviews from the API. Products 8 to 14 and 20 also carry the
// sample reviews of src/data/reviews.json, e.g. product 10 has four more (5, 4, 4 and 1 stars).
const reviews = (page: Page) => page.getByRole("region", { name: "Customer reviews" });
const reviewCards = (page: Page) => reviews(page).getByRole("article");

async function openProduct(page: Page, id: number) {
  await page.goto(`/products/${id}`);
  await expect(reviews(page)).toBeVisible();
}

// Clicks the visible star, as a shopper does (the radio input itself is visually hidden).
async function chooseStars(page: Page, stars: number) {
  await page.locator(`label:has(input[aria-label="${stars} ${stars === 1 ? "star" : "stars"}"])`).click();
  await expect(page.getByRole("radio", { name: `${stars} ${stars === 1 ? "star" : "stars"}`, exact: true })).toBeChecked();
}

async function write(page: Page, stars: number, text: string) {
  await chooseStars(page, stars);
  await page.getByLabel("Your review", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Submit review" }).click();
}

test.beforeEach(async ({ page }) => {
  await mockDummyJson(page);
});

test("a guest sees the rating summary, the distribution and the list, and is asked to sign in to write", async ({ page }) => {
  await openProduct(page, 1);

  await expect(page.getByRole("link", { name: "(3 reviews)" })).toBeVisible();
  await expect(reviews(page).getByText("Based on 3 reviews")).toBeVisible();
  await expect(reviews(page).getByTestId("review-average")).toHaveText("4.0");
  const breakdown = reviews(page).getByRole("list", { name: "Rating breakdown" });
  await expect(breakdown.getByRole("listitem")).toHaveCount(5);
  await expect(breakdown.getByText("3 (100%)")).toBeVisible();
  await expect(reviewCards(page)).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Submit review" })).toHaveCount(0);

  await page.getByRole("link", { name: "Sign in to write a review" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fproducts%2F1$/);
});

test("a customer writes a review that appears at once, changes the rating, survives a reload, and can be edited and deleted", async ({ page }) => {
  await signIn(page, CUSTOMER);
  await openProduct(page, 2);

  await write(page, 2, "Not what I hoped for, but delivery was quick.");
  await expect(reviews(page).getByText("Thank you. Your review was saved on this device.")).toBeVisible();
  const mine = page.getByRole("article", { name: "Review by Demo Customer" });
  await expect(mine).toContainText("Not what I hoped for, but delivery was quick.");
  await expect(mine).toContainText("Your review");
  await expect(page.getByRole("link", { name: "(4 reviews)" })).toBeVisible();
  // (4 + 4 + 4 + 2) / 4 = 3.5
  await expect(reviews(page).getByTestId("review-average")).toHaveText("3.5");
  // The rating line next to the review count (other product cards on the page may show their own ratings).
  await expect(page.getByRole("link", { name: "(4 reviews)" }).locator("..").getByLabel("Rated 3.5 out of 5")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit review" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("article", { name: "Review by Demo Customer" })).toContainText("Not what I hoped for");
  await expect(page.getByRole("link", { name: "(4 reviews)" })).toBeVisible();

  await page.getByRole("button", { name: "Edit your review" }).click();
  await chooseStars(page, 5);
  await page.getByLabel("Your review", { exact: true }).fill("Changed my mind: it has been excellent.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("article", { name: "Review by Demo Customer" })).toContainText("Changed my mind: it has been excellent.");
  await expect(page.getByRole("article", { name: "Review by Demo Customer" })).toContainText("(edited)");
  await expect(reviews(page).getByTestId("review-average")).toHaveText("4.3");

  await page.getByRole("button", { name: "Delete your review" }).click();
  await page.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByRole("article", { name: "Review by Demo Customer" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "(3 reviews)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();
});

test("the review form validates rating and length with errors tied to the fields", async ({ page }) => {
  await signIn(page, CUSTOMER);
  await openProduct(page, 2);

  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText("Choose a rating from 1 to 5 stars.")).toBeVisible();
  await expect(page.getByText("Write a few words about the product.")).toBeVisible();

  await chooseStars(page, 4);
  await page.getByLabel("Your review", { exact: true }).fill("too short");
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText(/at least 10 characters/)).toBeVisible();
  await expect(page.getByLabel("Your review", { exact: true })).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Your review", { exact: true }).fill("x".repeat(1001));
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText(/at most 1000 characters/)).toBeVisible();
  await expect(reviewCards(page)).toHaveCount(3);
});

test("a purchase in the customer's order history earns the verified-purchase marker", async ({ page }) => {
  await signIn(page, CUSTOMER);

  // The demo customer's sample orders include product 3 but not product 9.
  await openProduct(page, 3);
  await expect(reviews(page).getByText("will be marked as a verified purchase")).toBeVisible();
  await write(page, 5, "Bought it last month and still love it.");
  await expect(page.getByRole("article", { name: "Review by Demo Customer" })).toContainText("Verified purchase");

  await openProduct(page, 9);
  await expect(reviews(page).getByText("will not be marked as a verified purchase")).toBeVisible();
  await write(page, 3, "Looks fine, though I have not bought it yet.");
  await expect(page.getByRole("article", { name: "Review by Demo Customer" })).not.toContainText("Verified purchase");
});

test("reviews can be sorted, and the sample reviews carry verified flags and helpful counts", async ({ page }) => {
  await openProduct(page, 10);
  const ratingOfFirst = async () => (await reviewCards(page).first().getByRole("img").getAttribute("aria-label")) ?? "";

  await page.getByLabel("Sort reviews").selectOption("lowest");
  expect(await ratingOfFirst()).toBe("Rated 1 out of 5");
  await page.getByLabel("Sort reviews").selectOption("highest");
  expect(await ratingOfFirst()).toBe("Rated 5 out of 5");
  await page.getByLabel("Sort reviews").selectOption("helpful");
  await expect(reviewCards(page).first()).toContainText("Deepa Nair");
  await expect(reviewCards(page).first()).toContainText("Verified purchase");
  await page.getByLabel("Sort reviews").selectOption("recent");
  await expect(reviewCards(page).first()).toContainText("Sana Qureshi");
});

test("helpful voting counts once, can be changed or withdrawn, and is remembered", async ({ page }) => {
  await openProduct(page, 10);
  const card = page.getByRole("article", { name: "Review by Sana Qureshi" });

  await card.getByRole("button", { name: /^Helpful/ }).click();
  await expect(card.getByRole("button", { name: /^Helpful/ })).toContainText("Helpful (9)");
  await expect(card.getByRole("button", { name: /^Helpful/ })).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByRole("article", { name: "Review by Sana Qureshi" }).getByRole("button", { name: /^Helpful/ })).toContainText("Helpful (9)");

  await page.getByRole("article", { name: "Review by Sana Qureshi" }).getByRole("button", { name: /^Not helpful/ }).click();
  await expect(page.getByRole("article", { name: "Review by Sana Qureshi" })).toContainText("Helpful (8)");
  await expect(page.getByRole("article", { name: "Review by Sana Qureshi" })).toContainText("Not helpful (1)");
});

test("an administrator moderates: hidden reviews disappear for shoppers and from the rating, and can be restored", async ({ page }) => {
  await signIn(page, ADMIN);
  await openProduct(page, 10);
  await expect(reviews(page).getByText("Administrators moderate reviews")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit review" })).toHaveCount(0);
  await expect(reviews(page).getByText("Based on 7 reviews")).toBeVisible();

  const target = page.getByRole("article", { name: "Review by Deepa Nair" });
  await expect(target.getByText("Local simulation")).toBeVisible();
  await target.getByRole("button", { name: /Hide review/ }).click();
  await expect(target).toHaveAttribute("data-hidden", "true");
  await expect(reviews(page).getByText("Based on 6 reviews")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await openProduct(page, 10);
  await expect(page.getByRole("article", { name: "Review by Deepa Nair" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "(6 reviews)" })).toBeVisible();

  await signIn(page, ADMIN);
  await page.goto("/admin/reviews");
  await page.getByLabel("Show").selectOption("hidden");
  await page.getByRole("button", { name: "Restore review by Deepa Nair" }).click();
  await openProduct(page, 10);
  await expect(page.getByRole("link", { name: "(7 reviews)" })).toBeVisible();
});

test("review text is shown as plain text and cannot inject markup (PRD 13)", async ({ page }) => {
  await signIn(page, CUSTOMER);
  await openProduct(page, 2);
  const attack = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
  await write(page, 4, attack);

  await expect(page.getByRole("article", { name: "Review by Demo Customer" })).toContainText(attack);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(reviews(page).locator("img[src='x']")).toHaveCount(0);
});

test("the review section works on a phone-sized screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await openProduct(page, 10);
  await expect(reviewCards(page).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
