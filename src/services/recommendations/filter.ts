import { getVariantGroup } from "@/services/products/variants";
import { stemWord, tokenizeWords } from "@/utils/text";
import type { ProductFilter } from "./types";
import type { Product } from "@/types/product";

/**
 * The filter half of the "assistant" strategy (PRD 7.3): decides whether a product satisfies the structured filter the
 * shopping assistant extracted. Pure and deterministic. Price is compared with the discounted price, like discovery.
 */

const topicWords = new WeakMap<Product, Set<string>>();
const describedWords = new WeakMap<Product, Set<string>>();

/** Word stems of the fields a product TYPE is recognised by: title, tags and category. Descriptions are left out on purpose. */
function wordsOf(product: Product): Set<string> {
  let words = topicWords.get(product);
  if (!words) {
    words = new Set(tokenizeWords([product.title, product.category, ...product.tags].join(" ")));
    topicWords.set(product, words);
  }
  return words;
}

/** Word stems of everything a product says about itself, for colours ("Blue Frock", "available in navy blue"). */
function describedBy(product: Product): Set<string> {
  let words = describedWords.get(product);
  if (!words) {
    words = new Set(tokenizeWords([product.title, product.description, ...product.tags].join(" ")));
    describedWords.set(product, words);
  }
  return words;
}

/**
 * Whether a product comes in a colour: the colour is named in its title, description or tags, or the (simulated)
 * colour variants of its category include it with stock. "Where the dataset supports it" (PRD 7.4).
 */
export function hasColour(product: Product, colour: string): boolean {
  const wanted = colour.toLowerCase();
  if (describedBy(product).has(stemWord(wanted))) return true;
  const group = getVariantGroup(product);
  return group?.id === "color" && group.options.some((option) => option.stock > 0 && option.label.toLowerCase() === wanted);
}

function matchesTopic(product: Product, filter: ProductFilter): boolean {
  const categories = filter.categories ?? [];
  const keywords = filter.keywords ?? [];
  if (categories.length === 0 && keywords.length === 0) return true;
  if (categories.includes(product.category)) return true;
  if (keywords.length === 0) return false;
  const words = wordsOf(product);
  return keywords.some((keyword) => words.has(stemWord(keyword)));
}

export function matchesFilter(product: Product, filter: ProductFilter): boolean {
  if (!matchesTopic(product, filter)) return false;
  if (filter.minPrice !== undefined && product.finalPrice < filter.minPrice) return false;
  if (filter.maxPrice !== undefined && product.finalPrice > filter.maxPrice) return false;
  if (filter.minRating !== undefined && product.rating < filter.minRating) return false;
  if (filter.colour !== undefined && !hasColour(product, filter.colour)) return false;
  return true;
}

/** A stable cache key for a filter: the same filter always gives the same key, whatever the order of its fields. */
export function filterKey(filter: ProductFilter): string {
  return JSON.stringify([
    [...(filter.categories ?? [])].sort(),
    [...(filter.keywords ?? [])].sort(),
    filter.minPrice ?? null,
    filter.maxPrice ?? null,
    filter.minRating ?? null,
    filter.colour ?? null,
    filter.sort ?? null,
    filter.label ?? null,
  ]);
}
