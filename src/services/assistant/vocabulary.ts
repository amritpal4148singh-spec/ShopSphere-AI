import { levenshtein, stemWord, tokenizeWords } from "@/utils/text";
import type { Product } from "@/types/product";

/**
 * What the assistant knows how to recognise (PRD 7.1: keyword, pattern and entity extraction). A "topic" is a product
 * type a shopper can ask for. Most are a catalogue category; some are a group of categories (shoes) or a product type
 * that is not a category at all (headphones, found by keyword in the title and tags).
 */
export interface Topic {
  /** The `category` of the structured intent: a type ("headphones", "shoes") or a category slug ("mens-shoes"). */
  id: string;
  /** For chips and headings: "Headphones". */
  label: string;
  /** For sentences: "headphones", "men's shoes". */
  noun: string;
  /** Phrases a shopper may use; compared word by word after stemming. */
  aliases: string[];
  /** Catalogue category slugs that count as this topic. */
  categories: string[];
  /** Single words matched against product titles and tags (for types that are not a category). */
  keywords: string[];
}

interface TopicSpec {
  id: string;
  noun?: string;
  aliases: string[];
  categories?: string[];
  keywords?: string[];
}

/** "mens-shoes" -> "men's shoes". */
export function slugNoun(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word === "mens" ? "men's" : word === "womens" ? "women's" : word))
    .join(" ");
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const SPECS: TopicSpec[] = [
  { id: "smartphones", aliases: ["smartphone", "smart phone", "phone", "mobile", "mobile phone", "cell phone", "cellphone", "android phone", "iphone", "android"] },
  { id: "laptops", aliases: ["laptop", "notebook", "macbook"] },
  { id: "tablets", aliases: ["tablet", "ipad"] },
  {
    id: "headphones",
    noun: "headphones",
    aliases: ["headphone", "head phone", "earphone", "ear phone", "earbud", "ear bud", "headset", "airpod", "earpod"],
    categories: [],
    keywords: ["headphone", "earphone", "earbud", "headset", "airpod", "earpod"],
  },
  { id: "mobile-accessories", aliases: ["phone accessory", "mobile accessory", "charger", "cable", "power bank", "powerbank", "phone case", "phone cover", "phone charger", "mobile charger", "phone cable", "mobile cable", "phone stand"] },
  { id: "shoes", noun: "shoes", aliases: ["shoe", "sneaker", "footwear"], categories: ["mens-shoes", "womens-shoes"] },
  { id: "mens-shoes", aliases: ["shoes for men", "shoe for men", "men shoe", "mens sneaker", "men sneaker", "mens footwear"] },
  { id: "womens-shoes", aliases: ["shoes for women", "shoe for women", "women shoe", "ladies shoe", "womens sneaker", "heel"] },
  { id: "watches", noun: "watches", aliases: ["watch", "wristwatch"], categories: ["mens-watches", "womens-watches"] },
  { id: "mens-watches", aliases: ["watch for men", "men watch"] },
  { id: "womens-watches", aliases: ["watch for women", "women watch", "ladies watch"] },
  { id: "mens-shirts", aliases: ["shirt", "mens shirt", "men shirt"] },
  { id: "tops", aliases: ["t shirt", "tshirt", "tee", "womens top", "women top", "blouse"] },
  { id: "womens-dresses", aliases: ["dress", "gown", "frock"] },
  { id: "womens-bags", aliases: ["bag", "handbag", "hand bag", "purse"] },
  { id: "womens-jewellery", aliases: ["jewellery", "jewelry", "necklace", "bracelet", "earring"] },
  { id: "sunglasses", aliases: ["sunglass", "sun glass", "shade"] },
  { id: "furniture", aliases: ["furniture", "sofa", "couch", "chair", "desk", "bed"] },
  { id: "home-decoration", aliases: ["home decor", "decor", "decoration"] },
  { id: "kitchen-accessories", aliases: ["kitchen", "cookware", "utensil"] },
  { id: "skin-care", aliases: ["skincare", "skin care", "moisturizer", "moisturiser", "sunscreen", "face wash", "serum"] },
  { id: "beauty", aliases: ["makeup", "make up", "cosmetic", "lipstick", "mascara", "eyeliner", "nail polish"] },
  { id: "fragrances", aliases: ["perfume", "cologne", "deodorant"] },
  { id: "groceries", aliases: ["grocery", "food"] },
  { id: "sports-accessories", aliases: ["sport", "sports equipment", "sports gear"] },
  { id: "motorcycle", noun: "motorcycles", aliases: ["motorcycle", "motorbike", "bike"] },
  { id: "vehicle", noun: "vehicles", aliases: ["car", "vehicle"] },
];

/** Words that are products in one reading and something else in another ("top rated"), so alone they never name a topic. */
const AMBIGUOUS_SINGLE_WORDS = new Set(["top", "table", "case", "best", "good", "new", "set"]);

/**
 * The topics for a catalogue: the built-in ones plus one for every catalogue category that has none yet, named after
 * the category itself, so a category the assistant was not told about still works.
 */
export function buildTopics(catalog: readonly Pick<Product, "category">[]): Topic[] {
  const topics: Topic[] = SPECS.map((spec) => {
    const categories = spec.categories ?? [spec.id];
    const noun = spec.noun ?? slugNoun(spec.id);
    const aliases = [...spec.aliases, ...(spec.id.includes("-") || categories.includes(spec.id) ? [slugNoun(spec.id), spec.id.replace(/-/g, " "), noun] : [spec.id, noun])];
    return { id: spec.id, label: capitalise(noun), noun, aliases: [...new Set(aliases)], categories, keywords: spec.keywords ?? [] };
  });

  const known = new Set(topics.map((topic) => topic.id));
  for (const slug of new Set(catalog.map((product) => product.category))) {
    if (known.has(slug)) continue;
    const noun = slugNoun(slug);
    topics.push({ id: slug, label: capitalise(noun), noun, aliases: [noun, slug.replace(/-/g, " ")], categories: [slug], keywords: [] });
    known.add(slug);
  }
  return topics;
}

interface AliasEntry {
  tokens: string[];
  topic: Topic;
}

/** Every alias of every topic as stemmed words, longest first, so "mobile accessories" wins over "mobile". */
function aliasIndex(topics: readonly Topic[]): AliasEntry[] {
  const entries: AliasEntry[] = [];
  for (const topic of topics) {
    for (const alias of topic.aliases) {
      const tokens = tokenizeWords(alias);
      if (tokens.length === 0) continue;
      if (tokens.length === 1 && AMBIGUOUS_SINGLE_WORDS.has(tokens[0] as string)) continue;
      entries.push({ tokens, topic });
    }
  }
  return entries.sort((a, b) => b.tokens.length - a.tokens.length);
}

const NEGATIONS = new Set(["not", "than", "without", "except", "no"]);

function isNegated(tokens: readonly string[], index: number): boolean {
  const before = tokens[index - 1];
  if (before !== undefined && NEGATIONS.has(before)) return true;
  // "headphones instead of phones": the topic after "instead of" is the one being left behind.
  return tokens[index - 2] === "instead" && before === "of";
}

/**
 * Words the parser gives another meaning to. A near-miss spelling is never "corrected" into a topic from these,
 * so "cheaper" can not become "charger".
 */
const RESERVED_WORDS = new Set([
  "cheaper", "cheap", "pricier", "costlier", "expensive", "similar", "rating", "rated", "review", "reviewed", "better", "higher", "lower",
  "instead", "actually", "something", "anything", "show", "find", "under", "below", "above", "between", "within", "maximum", "minimum",
  "options", "product", "products", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "premium", "luxury", "budget",
  "excellent", "outstanding", "highest", "decent", "positive", "affordable", "thousand", "rupee", "rupees", "number", "newest", "latest",
]);

/** Finds the topic a message asks for: the longest known phrase (leaving out phrases that are being rejected), else a close misspelling. */
export function findTopic(tokens: readonly string[], topics: readonly Topic[]): Topic | null {
  const index = aliasIndex(topics);

  let best: { topic: Topic; length: number; start: number } | null = null;
  for (let start = 0; start < tokens.length; start += 1) {
    if (isNegated(tokens, start)) continue;
    for (const entry of index) {
      if (start + entry.tokens.length > tokens.length) continue;
      if (!entry.tokens.every((token, offset) => tokens[start + offset] === token)) continue;
      if (!best || entry.tokens.length > best.length) best = { topic: entry.topic, length: entry.tokens.length, start };
      break; // The index is sorted longest first, so the first hit at this position is the longest.
    }
  }
  if (best) return best.topic;

  // No known phrase: tolerate one slip in a longer word ("headphnes", "smartphnes", "laptpos").
  const singles = index.filter((entry) => entry.tokens.length === 1);
  let nearest: { topic: Topic; distance: number } | null = null;
  let tied = false;
  tokens.forEach((token, position) => {
    if (token.length < 6 || RESERVED_WORDS.has(token) || RESERVED_WORDS.has(stemWord(token)) || isNegated(tokens, position)) return;
    const allowed = token.length >= 9 ? 2 : 1;
    for (const entry of singles) {
      const word = entry.tokens[0] as string;
      if (Math.abs(word.length - token.length) > allowed) continue;
      const distance = levenshtein(token, word);
      if (distance === 0 || distance > allowed) continue;
      if (!nearest || distance < nearest.distance) {
        nearest = { topic: entry.topic, distance };
        tied = false;
      } else if (distance === nearest.distance && entry.topic.id !== nearest.topic.id) {
        tied = true;
      }
    }
  });
  return nearest && !tied ? (nearest as { topic: Topic }).topic : null;
}

/** The structured filter the recommendation engine executes for a topic's part of the intent. */
export function topicFilter(topic: Topic | undefined): { categories?: string[]; keywords?: string[]; label?: string } {
  if (!topic) return {};
  return {
    ...(topic.categories.length ? { categories: topic.categories } : {}),
    ...(topic.keywords.length ? { keywords: topic.keywords } : {}),
    label: topic.noun,
  };
}

export const COLOURS = ["black", "white", "blue", "red", "green", "yellow", "orange", "purple", "pink", "brown", "grey", "silver", "gold", "beige", "navy", "maroon", "cyan", "teal", "violet"] as const;

export const COLOUR_ALIASES: Record<string, string> = { gray: "grey", golden: "gold" };
