import * as strategies from "./strategies";
import type { RecommendationProvider, RecommendationRequest, RecommendationResult } from "./types";

/** Runs one strategy synchronously. Deterministic: the same request always gives the same result. */
export function runStrategy(request: RecommendationRequest): RecommendationResult {
  const context = strategies.buildContext(request);
  switch (request.strategy) {
    case "recently-viewed":
      return strategies.recentlyViewed(context);
    case "similar":
      return strategies.similar(context);
    case "category-based":
      return strategies.categoryBased(context);
    case "price-based":
      return strategies.priceBased(context);
    case "wishlist-based":
      return strategies.wishlistBased(context);
    case "cart-based":
      return strategies.cartBased(context);
    case "frequently-bought-together":
      return strategies.frequentlyBoughtTogether(context);
    case "trending":
      return strategies.trending(context);
    case "personalized":
      return strategies.personalized(context);
    case "featured":
      return strategies.featured(context);
    case "assistant":
      return strategies.intentSearch(context);
  }
}

/**
 * The mock provider (PRD 6.4): rule- and score-based, no machine learning and no network. It implements the same
 * asynchronous contract an ML or LLM provider would, so it can be replaced without touching the service or the UI.
 */
export const mockRecommendationEngine: RecommendationProvider = {
  id: "mock-engine",
  async recommend(request) {
    return runStrategy(request);
  },
};
