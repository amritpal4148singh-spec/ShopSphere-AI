import data from "@/data/recommendations.json";

/** Simulated co-purchase strength between two categories (0..1), symmetric. */
const pairStrength = new Map<string, number>();
for (const pair of data.categoryPairs) {
  pairStrength.set(`${pair.a}|${pair.b}`, pair.strength);
  pairStrength.set(`${pair.b}|${pair.a}`, pair.strength);
}

export function categoryPairStrength(a: string, b: string): number {
  if (a === b) return data.sameCategoryStrength;
  return pairStrength.get(`${a}|${b}`) ?? 0;
}

/** Simulated popularity of a category (0..1). */
export function trendingCategoryBoost(category: string): number {
  return (data.trendingCategoryBoost as Record<string, number>)[category] ?? data.defaultTrendingBoost;
}

export const FEATURED_RULE = data.featured;
