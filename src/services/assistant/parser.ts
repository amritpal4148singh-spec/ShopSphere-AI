import { EXCELLENT_RATING, GOOD_RATING } from "./constants";
import { COLOURS, COLOUR_ALIASES, findTopic, type Topic } from "./vocabulary";
import { tokenizeWords } from "@/utils/text";

/**
 * Structured intent extraction (PRD 7.3): turns one free-text message into the pieces of a structured filter, by
 * keyword, pattern and entity matching. No language model, no network, deterministic. It only reads the message;
 * combining it with the conversation so far is the planner's job (plan.ts).
 */

export type SimilarReference = { kind: "ordinal"; index: number } | { kind: "last" } | { kind: "this" };

export interface ParsedMessage {
  /** The message, lower-cased and tidied. */
  text: string;
  topic: Topic | null;
  minPrice?: number;
  maxPrice?: number;
  /** An explicit rating floor: "4 stars", "good ratings". */
  minRating?: number;
  /** "something cheaper" / "something more expensive". */
  priceStep?: "cheaper" | "pricier";
  /** "something with better ratings". */
  ratingStep: boolean;
  colour?: string;
  /** "only for gaming": what the products are for. Only read on refinement turns that name no product type. */
  useCase?: string;
  similar?: SimilarReference;
  /** "never mind", "instead": the shopper is changing course. */
  switchMarker: boolean;
  /** "start over". */
  reset: boolean;
  /** Small talk with no shopping content. */
  talk?: "greeting" | "help" | "thanks";
}

/** Whether the message asked for something the assistant can act on (as opposed to small talk or nonsense). */
export function hasIntent(parsed: ParsedMessage): boolean {
  return (
    parsed.topic !== null ||
    parsed.minPrice !== undefined ||
    parsed.maxPrice !== undefined ||
    parsed.minRating !== undefined ||
    parsed.priceStep !== undefined ||
    parsed.ratingStep ||
    parsed.colour !== undefined ||
    parsed.useCase !== undefined ||
    parsed.similar !== undefined
  );
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, "$1") // 30,000 and 1,00,000 -> 30000, 100000
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ ratings */

const STAR = String.raw`(\d(?:\.\d)?)`;
const NOT_MONEY = String.raw`(?!\d|\s*(?:k\b|thousand|lakh|lac|rupee|rs\b|inr|₹))`;
const RATING_NUMBER_PATTERNS: RegExp[] = [
  new RegExp(String.raw`\b(?:rated|rating|ratings)\s*(?:of|at|above|over|at least|more than|minimum|min|>=?|≥)?\s*${STAR}${NOT_MONEY}`),
  new RegExp(String.raw`${STAR}\s*\+?\s*(?:stars?|★)(?:\s*(?:and|or)\s*(?:up|above|more|higher|better|plus))?`),
  new RegExp(String.raw`${STAR}\s*(?:\+|plus)?\s*(?:or (?:more|higher|above|better)\s*)?(?:rating|ratings|rated)\b`),
];

function extractRatingNumber(text: string): { rating?: number; rest: string } {
  for (const pattern of RATING_NUMBER_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    const rating = Number(match[1]);
    if (rating >= 1 && rating <= 5) return { rating, rest: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}` };
  }
  return { rest: text };
}

const BETTER_RATED = /\b(?:(?:better|higher|more highly|improved)[- ](?:rated|ratings?|reviews?|reviewed)|rated (?:better|higher)|better reviewed)\b/;
const RATING_EXCELLENT = /\b(?:excellent|outstanding|top|best|highest)[- ]?(?:rated|ratings?|reviews?|reviewed)\b/;
const RATING_GOOD = /\b(?:(?:good|great|high|highly|well|decent|positive|nice|solid)[- ]?(?:rated|ratings?|reviews?|reviewed)|rated (?:well|highly))\b/;

/* ------------------------------------------------------------------ prices */

const SUFFIX = String.raw`(k|thousand|lakhs?|lacs?)`;
const AMOUNT = String.raw`(\d+(?:\.\d+)?)\s*${SUFFIX}?`;
const RANGE = new RegExp(
  String.raw`(?:\b(?:between|from)\s+)?(?:₹|rs\.?|inr)?\s*${AMOUNT}\s*(?:rupees?)?\s*(?:\band\b|\bto\b|-|\btill\b|\buntil\b)\s*(?:₹|rs\.?|inr)?\s*${AMOUNT}`,
);
const SINGLE = new RegExp(String.raw`(?:(₹|rs\.?|inr)\s*)?${AMOUNT}\s*(₹|rupees?|\brs\b\.?|\binr\b)?`, "g");

const CEILING = /(?:\b(?:under|below|beneath|less than|lesser than|upto|up to|within|max(?:imum)?(?: price| budget)?(?: of)?|not more than|no more than|at most|cheaper than|lower than|budget(?: of| is)?|till|until|not above|not over)|<=?)\s*(?:around|about|approx\.?|approximately)?\s*$/;
const FLOOR = /(?:\b(?:above|over|more than|greater than|higher than|at least|minimum(?: of)?|min|starting(?: at| from)?|from|costlier than|pricier than|exceeding|beyond)|>=?)\s*$/;
const AROUND = /\b(?:around|about|approximately|approx\.?|roughly|nearly)\s*$/;

function amount(value: string | undefined, suffix: string | undefined): number {
  const base = Number(value);
  if (!suffix) return base;
  if (suffix.startsWith("k") || suffix.startsWith("thousand")) return base * 1_000;
  return base * 100_000;
}

const sensible = (value: number) => Number.isFinite(value) && value > 0 && value < 10_000_000;

interface PriceBounds {
  min?: number;
  max?: number;
}

function extractPrices(text: string): { bounds: PriceBounds; rest: string } {
  const bounds: PriceBounds = {};

  // "between 2000 and 5000", "2k-5k", "from 1000 to 3000"
  const range = RANGE.exec(text);
  if (range) {
    const [whole, a, aSuffix, b, bSuffix] = range;
    const first = amount(a, aSuffix);
    const second = amount(b, bSuffix);
    const bothSmallAndBare = first < 100 && second < 100 && !aSuffix && !bSuffix && !/₹|rs|inr|rupee/.test(whole);
    if (sensible(first) && sensible(second) && !bothSmallAndBare) {
      bounds.min = Math.min(first, second);
      bounds.max = Math.max(first, second);
      return { bounds, rest: `${text.slice(0, range.index)} ${text.slice(range.index + whole.length)}` };
    }
  }

  let rest = text;
  const spans: Array<[number, number]> = [];
  for (const match of text.matchAll(SINGLE)) {
    const [whole, prefix, digits, suffix, postfix] = match;
    const value = amount(digits, suffix);
    if (!sensible(value)) continue;
    const marked = Boolean(prefix || postfix || suffix);
    const before = text.slice(0, match.index);

    if (CEILING.test(before)) bounds.max = value;
    else if (FLOOR.test(before)) bounds.min = value;
    else if (AROUND.test(before)) {
      bounds.min = Math.round(value * 0.8);
      bounds.max = Math.round(value * 1.2);
    } else if (marked) bounds.max = value; // "headphones 3000 rupees": a bare amount is a budget
    else continue;
    spans.push([match.index, match.index + whole.length]);
  }
  for (const [start, end] of spans.reverse()) rest = `${rest.slice(0, start)} ${rest.slice(end)}`;

  if (bounds.min !== undefined && bounds.max !== undefined && bounds.min > bounds.max) [bounds.min, bounds.max] = [bounds.max, bounds.min];
  return { bounds, rest };
}

const CHEAPER = /\b(?:cheaper|less expensive|lower[- ]priced?|lower cost|more affordable|less costly|lower budget)\b/;
const PRICIER = /\b(?:more expensive|pricier|costlier|more costly|higher[- ]priced?|higher cost|premium|high[- ]end|luxury|upscale)\b/;

/* ------------------------------------------------------------------ similarity, colour, markers, small talk */

const ORDINAL_WORDS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
const SIMILAR = new RegExp(
  String.raw`\b(?:like|similar to|similar|alike|same as)\s+(?:the\s+)?(?:(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|final)|(\d{1,2})(?:st|nd|rd|th)\b|(?:number|no\.?|item|option|product|result|#)\s*(\d{1,2})|(this|that|it)\b)(?:\s+(?:one|item|product|result|option|pick))?`,
);
const COLOUR = new RegExp(String.raw`\b(${[...COLOURS, ...Object.keys(COLOUR_ALIASES)].join("|")})\b`);

const SWITCH = /\b(?:never ?mind|instead|actually|rather|forget (?:that|it|those)|scrap that|what about|how about|switch to|change to)\b/;
const RESET = /\b(?:start over|start again|reset|new search|clear (?:the )?(?:filters|chat|conversation|everything))\b/;
const GREETING = /^(?:hi+|hello+|hey+|hola|namaste|howdy|good (?:morning|afternoon|evening))(?: there| assistant| bot)?[\s!.,?]*$/;
const THANKS = /^(?:thanks?|thank you|thx|ty|cheers)\b[\s!.,a-z]{0,24}$/;
const HELP = /\b(?:help|what can you do|how do(?:es)? (?:this|you|it) work|who are you|what are you|are you (?:a |an )?(?:real|human|ai|bot|robot|chatgpt|gpt|llm)|about (?:you|this assistant))\b/;

function extractSimilar(text: string): { similar?: SimilarReference; rest: string } {
  const match = SIMILAR.exec(text);
  if (!match) return { rest: text };
  const [whole, word, digits, numbered, demonstrative] = match;
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + whole.length)}`;
  if (word === "last" || word === "final") return { similar: { kind: "last" }, rest };
  if (word) return { similar: { kind: "ordinal", index: ORDINAL_WORDS[word] as number }, rest };
  if (digits || numbered) return { similar: { kind: "ordinal", index: Number(digits ?? numbered) }, rest };
  if (demonstrative) return { similar: { kind: "this" }, rest };
  return { rest };
}

/** Parses one message. `topics` come from `buildTopics(catalog)`. */
/** "only for gaming", "good for travel", "for students": the word after "for" on a refinement turn. */
const USE_CASE = /\b(?:only\s+|just\s+|mainly\s+|mostly\s+)?(?:for|good for|suitable for|meant for)\s+(?:the\s+|a\s+|an\s+)?([a-z]+)$/;
const USE_CASE_STOPWORDS: ReadonlySet<string> = new Set(["me", "my", "you", "us", "it", "him", "her", "them", "this", "that", "now", "free", "sale", "under", "over", "below", "above", "less", "more", "about", "around", "up", "each", "one", "two"]);

export function parseMessage(input: string, topics: readonly Topic[]): ParsedMessage {
  const text = normalize(input);
  const parsed: ParsedMessage = { text, topic: null, ratingStep: false, switchMarker: SWITCH.test(text), reset: RESET.test(text) };

  // Entities with numbers go first and are cut out, so a "4" in "4 stars" is never mistaken for a price.
  const rating = extractRatingNumber(text);
  const prices = extractPrices(rating.rest);
  const reference = extractSimilar(prices.rest);
  const remaining = reference.rest;

  if (prices.bounds.min !== undefined) parsed.minPrice = prices.bounds.min;
  if (prices.bounds.max !== undefined) parsed.maxPrice = prices.bounds.max;
  if (reference.similar) parsed.similar = reference.similar;

  if (BETTER_RATED.test(remaining)) parsed.ratingStep = true;
  else if (rating.rating !== undefined) parsed.minRating = rating.rating;
  else if (RATING_EXCELLENT.test(remaining)) parsed.minRating = EXCELLENT_RATING;
  else if (RATING_GOOD.test(remaining)) parsed.minRating = GOOD_RATING;

  if (CHEAPER.test(remaining)) parsed.priceStep = "cheaper";
  else if (PRICIER.test(remaining)) parsed.priceStep = "pricier";

  const colour = COLOUR.exec(remaining)?.[1];
  if (colour) parsed.colour = COLOUR_ALIASES[colour] ?? colour;

  parsed.topic = findTopic(tokenizeWords(remaining), topics);

  if (parsed.topic === null) {
    const useCase = USE_CASE.exec(remaining.trim().replace(/[.!?]+$/, ""))?.[1];
    if (useCase && !USE_CASE_STOPWORDS.has(useCase)) parsed.useCase = useCase;
  }

  if (!hasIntent(parsed) && !parsed.reset) {
    if (GREETING.test(text)) parsed.talk = "greeting";
    else if (THANKS.test(text)) parsed.talk = "thanks";
    else if (HELP.test(text)) parsed.talk = "help";
  }
  return parsed;
}
