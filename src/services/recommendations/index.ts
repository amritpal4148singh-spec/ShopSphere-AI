export { DEFAULT_LIMIT, ENTITY_WEIGHTS, FULL_CONFIDENCE_EVIDENCE, PERSONALIZED_WEIGHTS } from "./constants";
export { mockRecommendationEngine, runStrategy } from "./mock-engine";
export { filterKey, hasColour, matchesFilter } from "./filter";
export { createRecommendationService, recommendationService } from "./service";
export type { RecommendationContext, RecommendationOptions, RecommendationService } from "./service";
export { assembleSignals, derivePriceBand, fingerprintInputs } from "./signals";
export { EMPTY_RAW_SIGNALS, PRD_STRATEGIES } from "./types";
export type {
  CartSignal,
  OrderSignal,
  PriceBand,
  ProductFilter,
  RawSignals,
  RecommendationProvider,
  RecommendationRequest,
  RecommendationResult,
  RecommendedProduct,
  ScoreBreakdown,
  ShopperSignals,
  SignalKind,
  StrategyId,
  ViewedSignal,
  WishlistSignal,
} from "./types";
