import { RECENCY_DECAY } from "./constants";
import { complementarity, priceSimilarity, relatedness, tagAffinityScore } from "./relations";
import type { ScoreBreakdown, ShopperSignals } from "./types";
import { PERSONALIZED_WEIGHTS } from "./constants";
import { formatInr } from "@/lib/currency";
import { titleCase } from "@/utils/text";
import type { Product } from "@/types/product";

/** The seven PRD components plus brand affinity and popularity, each normalized to 0..1 (PRD 6.2). */
export function scoreComponents(product: Product, signals: ShopperSignals, popularity: number): ScoreBreakdown {
  let recentlyViewedRelation = 0;
  signals.viewedProducts.forEach((viewed, rank) => {
    if (viewed.id !== product.id) recentlyViewedRelation = Math.max(recentlyViewedRelation, RECENCY_DECAY ** rank * relatedness(product, viewed));
  });

  let wishlistRelation = 0;
  for (const saved of signals.wishlistProducts) if (saved.id !== product.id) wishlistRelation = Math.max(wishlistRelation, relatedness(product, saved));

  let cartRelation = 0;
  for (const inCart of signals.cartProducts) if (inCart.id !== product.id) cartRelation = Math.max(cartRelation, complementarity(product, inCart));

  return {
    categoryMatch: signals.categoryAffinity[product.category] ?? 0,
    priceSimilarity: priceSimilarity(product.finalPrice, signals.priceBand),
    tagOverlap: tagAffinityScore(product.tags, signals.tagAffinity),
    normalizedRating: product.rating / 5,
    recentlyViewedRelation,
    wishlistRelation,
    cartRelation,
    brandAffinity: product.brand ? (signals.brandAffinity[product.brand] ?? 0) : 0,
    popularity,
  };
}

export function compositeScore(breakdown: ScoreBreakdown, weights: Record<keyof ScoreBreakdown, number> = PERSONALIZED_WEIGHTS): number {
  return (Object.keys(weights) as Array<keyof ScoreBreakdown>).reduce((sum, key) => sum + weights[key] * breakdown[key], 0);
}

function mostRelated(product: Product, candidates: readonly Product[], measure: (a: Product, b: Product) => number): Product | null {
  let best: Product | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (candidate.id === product.id) continue;
    const value = measure(product, candidate);
    if (value > bestScore) {
      best = candidate;
      bestScore = value;
    }
  }
  return best;
}

/**
 * Plain-language reasons for a score, strongest first (at most two). Each names the actual signal, such as the
 * viewed product or the price range, so nothing is presented as "recommended" without an explainable cause.
 */
export function explain(product: Product, breakdown: ScoreBreakdown, signals: ShopperSignals, weights = PERSONALIZED_WEIGHTS): string[] {
  const contributions = (Object.keys(weights) as Array<keyof ScoreBreakdown>)
    .map((key) => ({ key, value: weights[key] * breakdown[key] }))
    .filter((entry) => entry.value > 0.02)
    .sort((a, b) => b.value - a.value);

  const reasons: string[] = [];
  for (const { key } of contributions) {
    let reason: string | null = null;
    switch (key) {
      case "categoryMatch":
        reason = `Matches your interest in ${titleCase(product.category)}`;
        break;
      case "priceSimilarity":
        if (breakdown.priceSimilarity >= 0.9 && signals.priceBand) reason = `In your usual price range (${formatInr(signals.priceBand.min)} to ${formatInr(signals.priceBand.max)})`;
        break;
      case "tagOverlap": {
        const tag = [...new Set(product.tags)].sort((a, b) => (signals.tagAffinity[b] ?? 0) - (signals.tagAffinity[a] ?? 0))[0];
        if (tag && (signals.tagAffinity[tag] ?? 0) > 0) reason = `Shares your interest in "${tag}"`;
        break;
      }
      case "recentlyViewedRelation": {
        const viewed = mostRelated(product, signals.viewedProducts, relatedness);
        if (viewed) reason = `Similar to ${viewed.title}, which you viewed`;
        break;
      }
      case "wishlistRelation": {
        const saved = mostRelated(product, signals.wishlistProducts, relatedness);
        if (saved) reason = `Similar to ${saved.title} on your wishlist`;
        break;
      }
      case "cartRelation": {
        const inCart = mostRelated(product, signals.cartProducts, complementarity);
        if (inCart) reason = `Goes with ${inCart.title} in your cart`;
        break;
      }
      case "brandAffinity":
        if (product.brand) reason = `From ${product.brand}, a brand you favour`;
        break;
      case "normalizedRating":
        if (product.rating >= 4.5) reason = `Highly rated (${product.rating.toFixed(1)} out of 5)`;
        break;
      case "popularity":
        reason = "Popular with shoppers";
        break;
    }
    if (reason && !reasons.includes(reason)) reasons.push(reason);
    if (reasons.length === 2) break;
  }
  return reasons.length > 0 ? reasons : ["Popular with shoppers"];
}

