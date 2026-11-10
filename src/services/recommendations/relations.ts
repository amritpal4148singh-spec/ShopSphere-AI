import { categoryPairStrength } from "./mock-data";
import type { PriceBand } from "./types";
import type { Product } from "@/types/product";

/** Cosine similarity between two tag sets: 1 for identical, 0 for nothing shared. */
export function tagCosine(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const tag of setA) if (setB.has(tag)) shared += 1;
  return shared / Math.sqrt(setA.size * setB.size);
}

/** Cosine similarity between a product's tags and a tag-affinity profile (0..1). */
export function tagAffinityScore(tags: readonly string[], affinity: Record<string, number>): number {
  const unique = [...new Set(tags)];
  if (unique.length === 0) return 0;
  const dot = unique.reduce((sum, tag) => sum + (affinity[tag] ?? 0), 0);
  const profileNorm = Math.sqrt(Object.values(affinity).reduce((sum, value) => sum + value * value, 0));
  const norm = Math.sqrt(unique.length) * profileNorm;
  return norm === 0 ? 0 : Math.min(1, dot / norm);
}

type Related = Pick<Product, "category" | "brand" | "tags">;

/** How closely two products are related: same category, shared tags, same brand (0..1). */
export function relatedness(a: Related, b: Related): number {
  return 0.5 * (a.category === b.category ? 1 : 0) + 0.3 * tagCosine(a.tags, b.tags) + 0.2 * (a.brand !== null && a.brand === b.brand ? 1 : 0);
}

/** 1 inside the band, falling to 0 as the price moves a full band-midpoint away from it. No band means no information (0). */
export function priceSimilarity(price: number, band: PriceBand | null): number {
  if (!band) return 0;
  if (price >= band.min && price <= band.max) return 1;
  const midpoint = (band.min + band.max) / 2 || 1;
  const distance = price < band.min ? band.min - price : price - band.max;
  return Math.max(0, 1 - distance / midpoint);
}

/** The price band of a single product: 30% either side (used for "similar" and "bought together"). */
export function bandAround(price: number, spread = 0.3): PriceBand {
  return { min: price * (1 - spread), max: price * (1 + spread) };
}

/** How strongly two products are bought together: a category pair's simulated strength, or direct relatedness. */
export function complementarity(a: Related, b: Related): number {
  return Math.max(categoryPairStrength(a.category, b.category), 0.7 * relatedness(a, b));
}
