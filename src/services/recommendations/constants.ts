import type { ScoreBreakdown } from "./types";

/**
 * Score composition, documented for audit (PRD 6.2; see docs/RECOMMENDATIONS.md).
 * score = sum(weight[c] * component[c]) with every component normalized to 0..1 and the weights adding up to 1,
 * so the score is also in 0..1 and no single signal can dominate unintentionally.
 * w1..w7 are the PRD's components; brandAffinity and popularity are two documented additions
 * (the PRD lists brand preference as a signal, and popularity is what low-signal shoppers are blended with).
 */
export const PERSONALIZED_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  categoryMatch: 0.22, // w1
  priceSimilarity: 0.12, // w2
  tagOverlap: 0.14, // w3
  normalizedRating: 0.1, // w4
  recentlyViewedRelation: 0.16, // w5
  wishlistRelation: 0.08, // w6
  cartRelation: 0.08, // w7
  brandAffinity: 0.06, // extra: brand preference signal
  popularity: 0.04, // extra: general popularity
};

/** How much each kind of behaviour counts when building category, tag and brand affinities. */
export const ENTITY_WEIGHTS = { viewed: 1, wishlist: 1.5, cart: 2, purchase: 1.2, searchCategory: 0.6 } as const;

/** Each older view counts this much less than the one after it. */
export const RECENCY_DECAY = 0.85;

/** Evidence points per signal; confidence reaches 1 at FULL_CONFIDENCE_EVIDENCE (PRD edge case 25). */
export const EVIDENCE_POINTS = { viewed: 1, wishlist: 1.5, cart: 2, purchase: 1.5, search: 0.5 } as const;
export const MAX_SEARCHES_COUNTED = 3;
export const FULL_CONFIDENCE_EVIDENCE = 6;

export const DEFAULT_LIMIT = 8;
export const MAX_VIEWED = 20;
export const MAX_PER_CATEGORY = 4;
export const MIN_SIMILAR_SCORE = 0.25;
export const MIN_RELATION = 0.3;
