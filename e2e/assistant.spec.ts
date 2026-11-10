import { expect, test, type Page } from "@playwright/test";

import { mockDummyJson } from "./dummyjson-mock";
import { ADMIN } from "./fixtures";
import { signIn } from "./helpers";

const launcher = (page: Page) => page.getByRole("button", { name: /shopping assistant$/ });
const panel = (page: Page) => page.getByRole("dialog", { name: "Shopping Assistant" });
const box = (page: Page) => page.getByRole("textbox", { name: "Message the shopping assistant" });
const cards = (page: Page) => panel(page).getByRole("list", { name: "Products found" }).last().getByRole("heading", { level: 3 });

async function open(page: Page) {
  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
}

async function say(page: Page, text: string) {
  await box(page).fill(text);
  await box(page).press("Enter");
}

test.beforeEach(async ({ page }) => {
  await mockDummyJson(page, { audio: true });
});

test("MOD-AI-001: 'Show me headphones under 5000' shows matching cards inline and says which filters it applied", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await open(page);
  await say(page, "Show me headphones under 5000");

  await expect(panel(page).getByText(/Here are all 4 matches for headphones priced up to ₹5,000/)).toBeVisible();
  await expect(panel(page).getByRole("list", { name: "Filters applied" }).getByRole("listitem")).toHaveText(["Category: Headphones", "Price: up to ₹5,000"]);
  await expect(cards(page)).toHaveCount(4);
  const titles = (await cards(page).allTextContents()).sort();
  expect(titles).toEqual(["Test Blue Headset", "Test Headphones Alpha", "Test Headphones Bravo", "Test Headphones Charlie"]);
  await expect(panel(page).getByText("Test Headphones Delta")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("MOD-AI-002: 'something with better ratings' keeps headphones and ₹5,000 and raises the rating threshold", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await say(page, "Show me headphones under 5000");
  await expect(cards(page)).toHaveCount(4);

  await say(page, "show me something with better ratings");
  await expect(panel(page).getByText(/raised the minimum rating to 4 stars/)).toBeVisible();
  await expect(cards(page)).toHaveText(["Test Headphones Charlie", "Test Headphones Alpha", "Test Headphones Bravo", "Test Blue Headset"]);
  const filters = panel(page).getByRole("list", { name: "Filters applied" }).last().getByRole("listitem");
  await expect(filters).toHaveText(["Category: Headphones", "Price: up to ₹5,000", "Rating: 4+ stars"]);

  // Again: the threshold goes up another step, and the shopper never restates the category or the price.
  await say(page, "even better ratings");
  await expect(panel(page).getByText(/raised the minimum rating to 4.5 stars/)).toBeVisible();
  await expect(cards(page)).toHaveText(["Test Headphones Charlie", "Test Headphones Alpha"]);
});

test("MOD-AI-003: an unclear message gets a clarifying reply with 2-3 prompts and no products", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await say(page, "hmm not sure");

  await expect(panel(page).getByText(/not sure what you're looking for/)).toBeVisible();
  const prompts = panel(page).getByRole("list", { name: "Suggested prompts" }).getByRole("button");
  expect(await prompts.count()).toBeGreaterThanOrEqual(2);
  expect(await prompts.count()).toBeLessThanOrEqual(3);
  await expect(panel(page).getByRole("list", { name: "Products found" })).toHaveCount(0);

  // A suggested prompt works.
  await prompts.first().click();
  await expect(panel(page).getByText(/Here are all 4 matches for headphones/)).toBeVisible();
});

test("a starter prompt answers a first-time user, and cheaper / colour / similar follow-ups work", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await panel(page).getByRole("button", { name: "Show me headphones under ₹5,000" }).click();
  await expect(cards(page)).toHaveCount(4);

  await say(page, "Show me something cheaper");
  await expect(panel(page).getByText(/lowered the price limit/)).toBeVisible();
  const cheaper = await cards(page).allTextContents();
  expect(cheaper.length).toBeGreaterThan(0);
  expect(cheaper.length).toBeLessThan(4);

  await say(page, "Show me headphones in blue");
  await expect(cards(page)).toHaveText(["Test Blue Headset"]);

  await say(page, "Show me more like the first one");
  await expect(panel(page).getByText(/like Test Blue Headset \(result 1\)/)).toBeVisible();
  await expect(cards(page).first()).toBeVisible();
});

test("'never mind, show me X instead' changes topic and keeps the price band", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await say(page, "smartphones under 40000");
  await expect(cards(page)).toHaveText(["Test Phone Seven"]);

  await say(page, "Never mind, show me headphones instead");
  await expect(panel(page).getByText(/kept your price range \(up to ₹40,000\)/)).toBeVisible();
  await expect(panel(page).getByRole("list", { name: "Filters applied" }).last().getByRole("listitem")).toHaveText(["Category: Headphones", "Price: up to ₹40,000"]);
  expect(await cards(page).count()).toBeGreaterThan(1);
});

test("a message with no match says why and does not show unrelated products", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await say(page, "headphones under 500");
  await expect(panel(page).getByText(/The cheapest headphones I have cost ₹2,125/)).toBeVisible();
  await expect(panel(page).getByRole("list", { name: "Products found" })).toHaveCount(0);
});

test("when products cannot be loaded, an inline error with Retry appears, the history stays, and Retry recovers (PRD 16.1)", async ({ page }) => {
  const api = await mockDummyJson(page, { audio: true });
  await page.goto("/");
  api.failProducts = true;
  await open(page);
  await say(page, "Show me headphones under 5000");

  const alert = panel(page).getByRole("alert");
  await expect(alert).toContainText(/couldn't load the products just now/);
  await expect(panel(page).getByText("Show me headphones under 5000")).toBeVisible();

  api.failProducts = false;
  await alert.getByRole("button", { name: "Retry" }).click();
  await expect(cards(page)).toHaveCount(4);
  await expect(panel(page).getByRole("alert")).toHaveCount(0);
  await expect(panel(page).getByText("Show me headphones under 5000")).toHaveCount(1);
});

test("the conversation survives navigating to a product and a reload; the panel stays where the shopper left it", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await say(page, "Show me headphones under 5000");
  await expect(cards(page)).toHaveCount(4);

  await panel(page).getByRole("link", { name: "Test Headphones Charlie" }).click();
  await expect(page).toHaveURL(/\/products\/43$/);
  await expect(page.getByRole("heading", { level: 1, name: "Test Headphones Charlie" })).toBeVisible();
  // Client-side navigation keeps the panel open with the conversation in it.
  await expect(panel(page).getByText(/Here are all 4 matches/)).toBeVisible();

  await page.reload();
  await expect(panel(page)).toHaveCount(0);
  await open(page);
  await expect(panel(page).getByText(/Here are all 4 matches for headphones/)).toBeVisible();
  await expect(cards(page)).toHaveCount(4);

  // A new chat clears it.
  await panel(page).getByRole("button", { name: "Start a new chat" }).click();
  await expect(panel(page).getByRole("list", { name: "Starter prompts" })).toBeVisible();
});

test("keyboard: open with Enter, type and send, close with Escape and get focus back on the launcher", async ({ page }) => {
  await page.goto("/");
  await launcher(page).focus();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toBeVisible();
  await expect(box(page)).toBeFocused();

  await page.keyboard.type("laptops under 100000");
  await page.keyboard.press("Enter");
  await expect(panel(page).getByText(/matches? for laptops/)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(launcher(page)).toBeFocused();
});

test("the About text says plainly that the assistant is rule-based", async ({ page }) => {
  await page.goto("/");
  await open(page);
  await expect(panel(page).getByText("Rule-based", { exact: true })).toBeVisible();
  await panel(page).getByRole("button", { name: "About this assistant" }).click();
  await expect(panel(page).getByText(/rule-based, mock shopping assistant, not a language model/)).toBeVisible();
  await say(page, "what can you do?");
  await expect(panel(page).getByText(/rule-based, not a language model/).first()).toBeVisible();
});

test("a guest and a customer have the assistant, an administrator does not (PRD 4.3)", async ({ page }) => {
  await page.goto("/");
  await expect(launcher(page)).toBeVisible();

  await signIn(page);
  await page.goto("/");
  await expect(launcher(page)).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  await signIn(page, ADMIN);
  await page.goto("/admin");
  await expect(launcher(page)).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the assistant is one tap away at the bottom of the screen, takes the whole screen, and keeps focus inside", async ({ page }) => {
    await page.goto("/");
    const button = launcher(page);
    const buttonBox = (await button.boundingBox())!;
    expect(buttonBox.y + buttonBox.height).toBeGreaterThan(844 - 40);
    expect(buttonBox.x + buttonBox.width).toBeGreaterThan(390 - 40);

    await button.click();
    const box_ = (await panel(page).boundingBox())!;
    expect(Math.round(box_.width)).toBe(390);
    expect(Math.round(box_.height)).toBe(844);
    await expect(panel(page)).toHaveAttribute("aria-modal", "true");
    await expect(button).toBeHidden();

    await say(page, "Show me headphones under 5000");
    await expect(cards(page)).toHaveCount(4);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);

    // Tab never leaves the dialog.
    for (let index = 0; index < 25; index += 1) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    }

    await panel(page).getByRole("button", { name: "Close assistant" }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(launcher(page)).toBeFocused();
  });
});

test.describe("on a tablet", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("the assistant is a side panel that leaves the page visible", async ({ page }) => {
    await page.goto("/");
    await open(page);
    const dialogBox = (await panel(page).boundingBox())!;
    expect(dialogBox.width).toBeLessThan(450);
    await expect(panel(page)).toHaveAttribute("aria-modal", "false");
    await expect(page.getByRole("link", { name: "ShopSphere AI" }).first()).toBeVisible();
  });
});
