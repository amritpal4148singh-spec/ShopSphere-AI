import { RESULT_LIMIT } from "./constants";
import {
  GREETING_TEXT,
  HELP_TEXT,
  RESET_TEXT,
  THANKS_TEXT,
  STARTER_PROMPTS,
  appliedFilters,
  clarifySuggestions,
  clarifyText,
  followUpPrompts,
  noResultsText,
  resultsText,
  similarText,
} from "./messages";
import { parseMessage } from "./parser";
import { planTurn, type Plan } from "./plan";
import type { AssistantProvider, AssistantRequest } from "./types";
import { buildTopics, topicFilter, type Topic } from "./vocabulary";
import { formatInr } from "@/lib/currency";
import { describePriceBand } from "./plan";
import { recommendationService, type ProductFilter, type RecommendationResult, type RecommendationService } from "@/services/recommendations";
import { EMPTY_CONTEXT, type AssistantIntent, type AssistantItem, type AssistantResponse } from "@/types/assistant";

/** The part of the recommendation service the assistant needs: it runs the structured filter, it does not re-implement it (PRD 7.3). */
export type AssistantRecommender = Pick<RecommendationService, "recommend">;

const toItems = (result: RecommendationResult): AssistantItem[] => result.items.map((item) => ({ product: item.product, reasons: item.reasons }));

function filterFor(intent: AssistantIntent, topic: Topic | undefined): ProductFilter {
  return {
    ...topicFilter(topic),
    ...(intent.minPrice !== undefined ? { minPrice: intent.minPrice } : {}),
    ...(intent.maxPrice !== undefined ? { maxPrice: intent.maxPrice } : {}),
    ...(intent.minRating !== undefined ? { minRating: intent.minRating } : {}),
    ...(intent.colour !== undefined ? { colour: intent.colour } : {}),
    sort: intent.sort === "rating" ? "rating" : "relevance",
  };
}

/** Matches a use-case word at the start of a word, so "gaming" also finds "game" and "gamers". */
function matchUseCase(word: string): RegExp {
  const stem = word.replace(/(ing|ers|er|s)$/, "");
  const base = stem.length >= 3 ? stem : word;
  return new RegExp(`\\b${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

/**
 * The rule-based mock assistant (PRD 7.1). It parses the message into a structured intent, merges it with the
 * conversation, and has the recommendation service execute the result. It makes no network request and uses no
 * language model: the same message and context always give the same answer.
 */
export function createMockAssistantProvider(recommender: AssistantRecommender = recommendationService): AssistantProvider {
  return {
    id: "mock-assistant",

    async respond(request: AssistantRequest): Promise<AssistantResponse> {
      const topics = buildTopics(request.catalog);
      const parsed = parseMessage(request.text, topics);
      const plan = planTurn(parsed, request.context, request.catalog);
      const limit = request.limit ?? RESULT_LIMIT;
      const recommendationContext = { raw: request.raw, catalog: request.catalog, limit };
      const unchanged = { context: request.context, intent: request.context.intent };

      switch (plan.type) {
        case "talk":
          return talk(plan, request);

        case "clarify":
          return {
            kind: "clarify",
            text: clarifyText(plan.reason, plan.detail),
            filters: [],
            items: [],
            totalMatches: 0,
            suggestions: clarifySuggestions(plan.reason, plan.detail),
            ...unchanged,
          };

        case "similar": {
          // "More like this" keeps the topic, price and rating in force (PRD 7.2, 7.4): the similar products must still
          // satisfy them, and a later "something cheaper" must still be about the same kind of product.
          const inForce = request.context.intent;
          // Topic, budget and rating floor must still hold. Colour and use case describe the product the shopper pointed at,
          // so they do not limit "more like this" (the intent still remembers them for the next turn).
          const constrained = inForce.category !== undefined || inForce.minPrice !== undefined || inForce.maxPrice !== undefined || inForce.minRating !== undefined;
          const wide = { ...recommendationContext, limit: Math.max(limit, request.catalog.length) };
          const similar = await recommender.recommend("similar", wide, { productId: plan.seed.id });
          let candidates = similar.items.filter((item) => item.product.id !== plan.seed.id);
          if (constrained) {
            const topic = inForce.category ? topics.find((candidate) => candidate.id === inForce.category) : undefined;
            const allowed = await recommender.recommend("assistant", wide, { filter: filterFor({ ...inForce, colour: undefined, useCase: undefined }, topic) });
            const allowedIds = new Set(allowed.items.map((item) => item.product.id));
            candidates = candidates.filter((item) => allowedIds.has(item.product.id));
          }
          const picked = candidates.slice(0, limit);
          if (picked.length === 0) {
            return {
              kind: "no-results",
              text: constrained
                ? `I couldn't find anything like ${plan.seed.title} that still fits your filters. Try loosening the price or rating, or ask for something else.`
                : `I couldn't find anything similar enough to ${plan.seed.title}.`,
              filters: [],
              items: [],
              totalMatches: 0,
              suggestions: followUpPrompts(request.context.shownIds.length),
              ...unchanged,
            };
          }
          const items = toItems({ ...similar, items: picked });
          const intent: AssistantIntent = constrained ? { ...inForce } : { category: plan.seed.category };
          const topicLabel = intent.category ? topics.find((candidate) => candidate.id === intent.category)?.label : undefined;
          return {
            kind: "similar",
            text: similarText({ shown: items.length, seedTitle: plan.seed.title, position: plan.position }),
            filters: [{ id: "similar", label: `Similar to: ${plan.seed.title}` }, ...appliedFilters(intent, topicLabel)],
            items,
            totalMatches: candidates.length,
            suggestions: followUpPrompts(items.length),
            context: { intent, shownIds: items.map((item) => item.product.id) },
            intent,
          };
        }

        case "search": {
          const topic = plan.intent.category ? topics.find((candidate) => candidate.id === plan.intent.category) : undefined;
          let intent = plan.intent;
          let notes = plan.notes;
          let result = await recommender.recommend("assistant", recommendationContext, { filter: filterFor(intent, topic) });
          let matchedTotal: number | undefined;

          if (intent.useCase !== undefined) {
            // A use-case word ("gaming") is not a catalogue filter, so it is matched against product text. When nothing
            // matches, say so and keep every other filter in force instead of silently dropping the conversation.
            const useCase = intent.useCase;
            const pattern = matchUseCase(useCase);
            const wide = await recommender.recommend("assistant", { ...recommendationContext, limit: request.catalog.length }, { filter: filterFor({ ...intent, useCase: undefined }, topic) });
            const matching = wide.items.filter((item) => pattern.test(`${item.product.title} ${item.product.description} ${item.product.tags.join(" ")}`.toLowerCase()));
            if (matching.length > 0) {
              result = { ...wide, items: matching.slice(0, limit) };
              matchedTotal = matching.length;
              notes = [...notes, `I matched "${useCase}" against product titles, descriptions and tags.`];
            } else {
              const { useCase: dropped, ...rest } = intent;
              void dropped;
              intent = rest;
              result = { ...wide, items: wide.items.slice(0, limit) };
              matchedTotal = wide.matched ?? wide.items.length;
              notes = [...notes, `None of the ${topic?.noun ?? "products"} are described as being for "${useCase}", and I can't filter by use case, so I kept your other filters.`];
            }
          }

          // A price band carried over from the previous topic is a general preference, not a requirement: if it leaves
          // nothing for the new topic, drop it and say so rather than answering "no results" to a change of subject.
          if (result.items.length === 0 && plan.carriedPrice && (intent.minPrice !== undefined || intent.maxPrice !== undefined)) {
            const { minPrice, maxPrice, ...withoutPrice } = intent;
            const wider = await recommender.recommend("assistant", recommendationContext, { filter: filterFor(withoutPrice, topic) });
            if (wider.items.length > 0) {
              const band = describePriceBand({ minPrice, maxPrice });
              result = wider;
              matchedTotal = undefined;
              intent = withoutPrice;
              notes = [`Nothing in ${topic?.noun ?? "that category"} is priced ${band}, so I dropped that price range.`];
            }
          }

          const filters = appliedFilters(intent, topic?.label);

          if (result.items.length > 0) {
            const items = toItems(result);
            const total = matchedTotal ?? result.matched ?? items.length;
            return {
              kind: "results",
              text: resultsText({ shown: items.length, total, noun: topic?.noun, intent, notes }),
              filters,
              items,
              totalMatches: total,
              suggestions: followUpPrompts(items.length),
              context: { intent, shownIds: items.map((item) => item.product.id) },
              intent,
            };
          }
          return noResults({ ...plan, intent, notes }, topic, request, recommender, recommendationContext, filters);
        }
      }
    },
  };
}

function talk(plan: Extract<Plan, { type: "talk" }>, request: AssistantRequest): AssistantResponse {
  const shown = request.context.shownIds.length;
  const base = { kind: "help" as const, filters: [], items: [], totalMatches: 0, context: request.context, intent: request.context.intent };
  switch (plan.talk) {
    case "greeting":
      return { ...base, text: GREETING_TEXT, suggestions: [...STARTER_PROMPTS] };
    case "help":
      return { ...base, text: HELP_TEXT, suggestions: [...STARTER_PROMPTS] };
    case "thanks":
      return { ...base, text: THANKS_TEXT, suggestions: shown > 0 ? followUpPrompts(shown) : [...STARTER_PROMPTS] };
    case "reset":
      return { ...base, text: RESET_TEXT, suggestions: [...STARTER_PROMPTS], context: EMPTY_CONTEXT, intent: {} };
  }
}

/**
 * Nothing matched. Says why in words, using what exists (how many of this type, the lowest price), keeps the earlier
 * context so the shopper can carry on from the products already shown, and never returns unrelated products.
 */
async function noResults(
  plan: Extract<Plan, { type: "search" }>,
  topic: Topic | undefined,
  request: AssistantRequest,
  recommender: AssistantRecommender,
  recommendationContext: { raw: AssistantRequest["raw"]; catalog: AssistantRequest["catalog"]; limit: number },
  filters: AssistantResponse["filters"],
): Promise<AssistantResponse> {
  const noun = topic?.noun ?? "products";
  const typeOnly = await recommender.recommend("assistant", { ...recommendationContext, limit: 1 }, { filter: { ...topicFilter(topic), sort: "price-asc" } });
  const anyOfType = typeOnly.matched ?? 0;
  const cheapest = typeOnly.items[0]?.product.finalPrice ?? null;

  const suggestions = [`Show me ${noun}`];
  if (plan.intent.maxPrice !== undefined && cheapest !== null) suggestions.push(`${noun.charAt(0).toUpperCase()}${noun.slice(1)} under ${formatInr(Math.ceil((cheapest * 1.25) / 100) * 100)}`);
  for (const prompt of STARTER_PROMPTS) if (suggestions.length < 3 && !suggestions.includes(prompt)) suggestions.push(prompt);

  return {
    kind: "no-results",
    text: noResultsText({ noun, intent: plan.intent, anyOfType, cheapest, ...(plan.step ? { step: plan.step } : {}) }),
    filters,
    items: [],
    totalMatches: 0,
    suggestions,
    context: request.context,
    intent: plan.intent,
  };
}
