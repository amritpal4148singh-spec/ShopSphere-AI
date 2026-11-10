import { describePriceBand } from "./plan";
import type { ClarifyReason } from "./plan";
import { formatInr } from "@/lib/currency";
import type { AppliedFilter, AssistantIntent } from "@/types/assistant";

/** Every sentence the assistant says, in one place, so the wording is easy to audit and test. */

/** PRD 7.1: the rule-based nature must be stated plainly in user-facing About/Help copy. */
export const ASSISTANT_DISCLOSURE =
  "This is a rule-based, mock shopping assistant, not a language model. It reads keywords, numbers and patterns in your message, turns them into filters (product type, price, rating, colour), and runs them against the product catalogue using the same scoring as the recommendation rails. It only understands shopping requests like the examples shown, and what you type stays in your browser.";

/** PRD 7.2: starter prompts for first-time use. */
export const STARTER_PROMPTS: readonly string[] = ["Show me headphones under ₹5,000", "Smartphones with good ratings", "Laptops under ₹60,000 with good ratings"];

export function followUpPrompts(shown: number): string[] {
  return ["Show me something cheaper", "Something with better ratings", shown > 1 ? "Show me more like the second one" : "Show me more like the first one"];
}

export const HELP_TEXT =
  "I'm ShopSphere's shopping assistant, and I'm rule-based, not a language model. Tell me a product type with a price limit and a rating, for example “headphones under ₹5,000 with good ratings”. Then refine it: “something cheaper”, “better ratings”, “only in blue” or “more like the second one”.";

export const GREETING_TEXT = "Hello! Tell me what you're looking for, for example a product type with a price limit or a rating. Here are a few ideas.";
export const THANKS_TEXT = "You're welcome! Say the word if you want to refine these or look for something else.";
export const RESET_TEXT = "Okay, starting fresh. What would you like to look for?";

/** The filters in force, as chips. */
export function appliedFilters(intent: AssistantIntent, categoryLabel: string | undefined): AppliedFilter[] {
  const filters: AppliedFilter[] = [];
  if (categoryLabel) filters.push({ id: "category", label: `Category: ${categoryLabel}` });
  const band = describePriceBand(intent);
  if (band) filters.push({ id: "price", label: `Price: ${band}` });
  if (intent.minRating !== undefined) filters.push({ id: "rating", label: `Rating: ${intent.minRating}+ stars` });
  if (intent.colour) filters.push({ id: "colour", label: `Colour: ${intent.colour}` });
  if (intent.useCase) filters.push({ id: "use-case", label: `For: ${intent.useCase}` });
  return filters;
}

function without(intent: AssistantIntent, key: keyof AssistantIntent): AssistantIntent {
  const copy = { ...intent };
  delete copy[key];
  return copy;
}

/** The filters as a phrase that follows the product noun: "up to ₹5,000, rated 4+ stars, in blue". */
function phrase(intent: AssistantIntent): string {
  const parts: string[] = [];
  const band = describePriceBand(intent);
  if (band) parts.push(`priced ${band}`);
  if (intent.minRating !== undefined) parts.push(`rated ${intent.minRating}+ stars`);
  if (intent.colour) parts.push(`in ${intent.colour}`);
  if (intent.useCase) parts.push(`for ${intent.useCase}`);
  return parts.length ? ` ${parts.join(", ")}` : "";
}

export function resultsText(args: { shown: number; total: number; noun: string | undefined; intent: AssistantIntent; notes: string[] }): string {
  const { shown, total, intent, notes } = args;
  const noun = args.noun ?? "products";
  const what = `${noun}${phrase(intent)}`;
  const count = total > shown ? `Here are the top ${shown} of ${total} ${what}.` : `Here ${shown === 1 ? "is the only match" : `are all ${shown} matches`} for ${what}.`;
  const ranking = intent.sort === "rating" ? " They are ranked by rating." : " They are ranked by rating, popularity and your activity on this device.";
  return `${notes.length ? `${notes.join(" ")} ` : ""}${count}${ranking}`;
}

export function similarText(args: { shown: number; seedTitle: string; position: number }): string {
  return `Here ${args.shown === 1 ? "is 1 product" : `are ${args.shown} products`} like ${args.seedTitle} (result ${args.position}). I compared category, tags and price.`;
}

export interface NoResultsFacts {
  noun: string;
  intent: AssistantIntent;
  /** How many products of this type exist at all (any price, rating or colour). */
  anyOfType: number;
  /** The lowest price among them. */
  cheapest: number | null;
  step?: "cheaper" | "pricier" | "better-rated";
}

export function noResultsText(facts: NoResultsFacts): string {
  const { noun, intent, anyOfType, cheapest, step } = facts;
  if (anyOfType === 0) return `I couldn't find any ${noun} in the catalogue right now.`;
  if (intent.colour) return `None of the ${noun}${phrase(without(intent, "colour"))} come in ${intent.colour}. I've kept your earlier filters, so you can carry on from there.`;
  if (step === "better-rated" || (intent.minRating !== undefined && step === undefined)) {
    return `No ${noun}${phrase(without(intent, "minRating"))} are rated ${intent.minRating}+ stars. The ones I showed are already the best rated within your filters.`;
  }
  if (step === "pricier") return `Nothing in ${noun}${intent.maxPrice !== undefined ? ` up to ${formatInr(intent.maxPrice)}` : ""} costs more than what I showed. Raise your price limit to see pricier ones.`;
  if (intent.maxPrice !== undefined && cheapest !== null) {
    return `I couldn't find ${noun}${phrase(intent)}. The cheapest ${noun} I have cost ${formatInr(cheapest)}.`;
  }
  return `I couldn't find ${noun}${phrase(intent)}. Try loosening a filter.`;
}

const CLARIFY: Record<ClarifyReason, string> = {
  unrecognized: "I'm not sure what you're looking for. I can find products by type, price and rating, for example “headphones under ₹5,000”. Try one of these:",
  "missing-topic": "Which kind of product are you looking for?",
  "nothing-shown": "I haven't shown you any products yet, so there's nothing to refine. Tell me what you're looking for, for example:",
  "ordinal-out-of-range": "I can't tell which product you mean.",
  "which-one": "Which product do you mean? Say “the first one”, “the second one” and so on.",
  "product-gone": "That product isn't in the catalogue any more. Try one of these:",
};

export function clarifyText(reason: ClarifyReason, detail?: { shown?: number; asked?: number; priceText?: string }): string {
  if (reason === "missing-topic" && detail?.priceText) return `Which kind of product do you want ${detail.priceText}? For example:`;
  if (reason === "ordinal-out-of-range" && detail?.shown !== undefined) {
    return `I only showed ${detail.shown} ${detail.shown === 1 ? "product" : "products"}${detail.asked && detail.asked > detail.shown ? `, so there is no number ${detail.asked}` : ""}. Say “the first one” up to “the ${ordinalWord(detail.shown)} one”.`;
  }
  return CLARIFY[reason];
}

function ordinalWord(n: number): string {
  return ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][n] ?? `${n}th`;
}

/** 2 to 3 prompts that would work, for a message the assistant could not act on (PRD MOD-AI-003). */
export function clarifySuggestions(reason: ClarifyReason, detail?: { priceText?: string }): string[] {
  if (reason === "missing-topic" && detail?.priceText) return [`Headphones ${detail.priceText}`, `Smartphones ${detail.priceText}`, `Shoes ${detail.priceText}`];
  if (reason === "ordinal-out-of-range" || reason === "which-one") return ["Show me more like the first one", "Show me more like the second one", "Show me something cheaper"];
  return [...STARTER_PROMPTS];
}
