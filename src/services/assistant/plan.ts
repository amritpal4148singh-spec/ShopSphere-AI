import { MAX_RATING_FILTER, MIN_PRICE_DROP, RATING_STEP, GOOD_RATING } from "./constants";
import { hasIntent, type ParsedMessage, type SimilarReference } from "./parser";
import { formatInr } from "@/lib/currency";
import type { AssistantIntent, ConversationContext } from "@/types/assistant";
import type { Product } from "@/types/product";

/**
 * Conversational refinement (PRD 7.4): combines what one message says with what the conversation already settled, and
 * decides what to do. Pure: it reads the parsed message, the context and the catalogue, and returns a plan.
 *
 * Rules, in short:
 * - The same product type again refines the filters in force; a different one starts a new search.
 * - A different product type introduced by a switch word ("never mind", "instead") keeps the price band, which is a
 *   general preference, and drops the rating and colour, which belonged to the old topic.
 * - "Cheaper", "more expensive" and "better ratings" are relative to the products just shown.
 */

export type ClarifyReason = "unrecognized" | "missing-topic" | "nothing-shown" | "ordinal-out-of-range" | "which-one" | "product-gone";

export type Plan =
  | { type: "talk"; talk: "greeting" | "help" | "thanks" | "reset" }
  | { type: "clarify"; reason: ClarifyReason; detail?: { shown?: number; asked?: number; priceText?: string } }
  | { type: "similar"; seed: Product; position: number }
  | {
      type: "search";
      intent: AssistantIntent;
      previous: AssistantIntent;
      /** What the assistant did to the earlier filters, in words ("I lowered the price limit to ..."). */
      notes: string[];
      step?: "cheaper" | "pricier" | "better-rated";
      topicChanged: boolean;
      /** True when the price band came from the previous topic rather than from this message. */
      carriedPrice: boolean;
    };

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function describePriceBand(intent: Pick<AssistantIntent, "minPrice" | "maxPrice">): string {
  const { minPrice, maxPrice } = intent;
  if (minPrice !== undefined && maxPrice !== undefined) return `between ${formatInr(minPrice)} and ${formatInr(maxPrice)}`;
  if (maxPrice !== undefined) return `up to ${formatInr(maxPrice)}`;
  if (minPrice !== undefined) return `from ${formatInr(minPrice)}`;
  return "";
}

function resolveSimilar(reference: SimilarReference, context: ConversationContext, catalog: readonly Product[]): Plan {
  const shownIds = context.shownIds;
  if (shownIds.length === 0) return { type: "clarify", reason: "nothing-shown" };

  let position: number;
  if (reference.kind === "ordinal") position = reference.index;
  else if (reference.kind === "last") position = shownIds.length;
  else if (shownIds.length === 1) position = 1;
  else return { type: "clarify", reason: "which-one", detail: { shown: shownIds.length } };

  const id = shownIds[position - 1];
  if (id === undefined || position < 1) return { type: "clarify", reason: "ordinal-out-of-range", detail: { shown: shownIds.length, asked: position } };
  const seed = catalog.find((product) => product.id === id);
  if (!seed) return { type: "clarify", reason: "product-gone" };
  return { type: "similar", seed, position };
}

export function planTurn(parsed: ParsedMessage, context: ConversationContext, catalog: readonly Product[]): Plan {
  if (parsed.reset) return { type: "talk", talk: "reset" };
  if (parsed.similar) return resolveSimilar(parsed.similar, context, catalog);

  if (!hasIntent(parsed)) return parsed.talk ? { type: "talk", talk: parsed.talk } : { type: "clarify", reason: "unrecognized" };

  const previous = context.intent;
  const topicId = parsed.topic?.id;
  const sameTopic = topicId !== undefined && topicId === previous.category;
  const topicChanged = topicId !== undefined && previous.category !== undefined && !sameTopic;
  const notes: string[] = [];
  let carriedPrice = false;

  let intent: AssistantIntent;
  if (topicId === undefined) {
    // Only constraints, no product type: they refine the current topic, if there is one.
    if (previous.category === undefined) {
      const band = describePriceBand({ ...(parsed.minPrice !== undefined ? { minPrice: parsed.minPrice } : {}), ...(parsed.maxPrice !== undefined ? { maxPrice: parsed.maxPrice } : {}) });
      return { type: "clarify", reason: "missing-topic", detail: band ? { priceText: band } : {} };
    }
    intent = { ...previous };
  } else if (sameTopic) {
    intent = { ...previous };
  } else if (topicChanged && parsed.switchMarker && parsed.minPrice === undefined && parsed.maxPrice === undefined && (previous.minPrice !== undefined || previous.maxPrice !== undefined)) {
    intent = {
      category: topicId,
      ...(previous.minPrice !== undefined ? { minPrice: previous.minPrice } : {}),
      ...(previous.maxPrice !== undefined ? { maxPrice: previous.maxPrice } : {}),
    };
    notes.push(`I kept your price range (${describePriceBand(previous)}).`);
    carriedPrice = true;
  } else {
    intent = { category: topicId };
  }

  // What the message says outright replaces what was there.
  if (parsed.minPrice !== undefined) {
    intent.minPrice = parsed.minPrice;
    if (parsed.maxPrice === undefined && intent.maxPrice !== undefined && intent.maxPrice < parsed.minPrice) delete intent.maxPrice;
  }
  if (parsed.maxPrice !== undefined) {
    intent.maxPrice = parsed.maxPrice;
    if (parsed.minPrice === undefined && intent.minPrice !== undefined && intent.minPrice > parsed.maxPrice) delete intent.minPrice;
  }
  if (parsed.minRating !== undefined) intent.minRating = parsed.minRating;
  if (parsed.colour !== undefined) intent.colour = parsed.colour;
  if (parsed.useCase !== undefined) intent.useCase = parsed.useCase;

  // Relative requests only make sense about the topic that was just shown.
  let step: "cheaper" | "pricier" | "better-rated" | undefined;
  const relative = parsed.priceStep !== undefined || parsed.ratingStep;
  if (relative && (topicId === undefined || sameTopic)) {
    const shown = context.shownIds.map((id) => catalog.find((product) => product.id === id)).filter((product): product is Product => product !== undefined);
    if (shown.length === 0) return { type: "clarify", reason: "nothing-shown" };
    const prices = shown.map((product) => product.finalPrice);

    if (parsed.priceStep === "cheaper") {
      step = "cheaper";
      const limit = Math.floor(Math.min(median(prices), Math.max(...prices) * (1 - MIN_PRICE_DROP)) / 10) * 10;
      intent.maxPrice = Math.max(limit, 1);
      if (intent.minPrice !== undefined && intent.minPrice > intent.maxPrice) delete intent.minPrice;
      notes.push(`I lowered the price limit to ${formatInr(intent.maxPrice)}, about the middle of the prices I just showed.`);
    } else if (parsed.priceStep === "pricier") {
      step = "pricier";
      intent.minPrice = Math.ceil(Math.max(median(prices), Math.min(...prices) * (1 + MIN_PRICE_DROP)) / 10) * 10;
      if (intent.maxPrice !== undefined && intent.maxPrice < intent.minPrice) delete intent.maxPrice;
      notes.push(`I set a minimum price of ${formatInr(intent.minPrice)}, about the middle of the prices I just showed.`);
    }

    if (parsed.ratingStep) {
      step = step ?? "better-rated";
      const current = intent.minRating ?? 0;
      const next = current < GOOD_RATING ? GOOD_RATING : Math.min(MAX_RATING_FILTER, current + RATING_STEP);
      if (next > current) {
        intent.minRating = next;
        notes.push(`I raised the minimum rating to ${next} stars and ranked by rating.`);
      } else {
        notes.push(`The minimum rating is already ${current} stars, as high as I go.`);
      }
      intent.sort = "rating";
    }
  }

  // Nothing at all to search for.
  if (intent.category === undefined && intent.minPrice === undefined && intent.maxPrice === undefined && intent.minRating === undefined && intent.colour === undefined) {
    return { type: "clarify", reason: "unrecognized" };
  }
  return { type: "search", intent, previous, notes, ...(step ? { step } : {}), topicChanged, carriedPrice: carriedPrice && parsed.minPrice === undefined && parsed.maxPrice === undefined };
}
