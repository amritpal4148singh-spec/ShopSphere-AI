import { DEFAULT_LIMIT } from "./constants";
import { mockRecommendationEngine } from "./mock-engine";
import { filterKey } from "./filter";
import { assembleSignals, fingerprintInputs } from "./signals";
import type { ProductFilter, RawSignals, RecommendationProvider, RecommendationResult, ShopperSignals, StrategyId } from "./types";
import type { Product } from "@/types/product";

export interface RecommendationContext {
  raw: RawSignals;
  catalog: readonly Product[];
  limit?: number;
}

export interface RecommendationOptions {
  productId?: number;
  categorySlug?: string;
  excludeIds?: number[];
  /** The structured filter of an "assistant" request (PRD 7.3). */
  filter?: ProductFilter;
}

export interface RecommendationService {
  /** Derives the shopper's signals from raw activity (also used by the dashboard's preferences panel). */
  signals(context: RecommendationContext): ShopperSignals;
  /** A key that changes whenever the inputs to recommendations change. */
  fingerprint(context: RecommendationContext): string;
  recommend(strategy: StrategyId, context: RecommendationContext, options?: RecommendationOptions): Promise<RecommendationResult>;
  clearCache(): void;
  /* Named entry points (PRD 6.4). Thin wrappers over `recommend`: no scoring or filtering logic lives here. */
  getPersonalized(context: RecommendationContext, options?: RecommendationOptions): Promise<RecommendationResult>;
  getSimilar(productId: number, context: RecommendationContext, options?: Omit<RecommendationOptions, "productId">): Promise<RecommendationResult>;
  getTrending(context: RecommendationContext, options?: RecommendationOptions): Promise<RecommendationResult>;
  getFrequentlyBoughtTogether(productId: number, context: RecommendationContext, options?: Omit<RecommendationOptions, "productId">): Promise<RecommendationResult>;
}

const MAX_CACHE_ENTRIES = 200;

/**
 * The recommendation service (PRD 6.4): assembles signals, calls the provider, and caches results by the inputs that
 * produced them, so identical requests are not recomputed and a change in activity, stock or prices is picked up.
 * The provider is injected, which is what makes it replaceable.
 */
export function createRecommendationService(provider: RecommendationProvider): RecommendationService {
  const results = new Map<string, Promise<RecommendationResult>>();
  const signalCache = new Map<string, ShopperSignals>();

  function signals(context: RecommendationContext): ShopperSignals {
    const key = fingerprintInputs(context.raw, context.catalog);
    const cached = signalCache.get(key);
    if (cached) return cached;
    const derived = assembleSignals(context.raw, context.catalog);
    if (signalCache.size >= 20) signalCache.delete(signalCache.keys().next().value as string);
    signalCache.set(key, derived);
    return derived;
  }

  const service: RecommendationService = {
    signals,
    fingerprint: (context) => fingerprintInputs(context.raw, context.catalog),

    recommend(strategy, context, options = {}) {
      const limit = context.limit ?? DEFAULT_LIMIT;
      const key = [
        provider.id,
        strategy,
        options.productId ?? "",
        options.categorySlug ?? "",
        [...(options.excludeIds ?? [])].sort((a, b) => a - b).join(","),
        options.filter ? filterKey(options.filter) : "",
        limit,
        fingerprintInputs(context.raw, context.catalog),
      ].join("|");

      const hit = results.get(key);
      if (hit) return hit;

      const request = {
        strategy,
        limit,
        signals: signals(context),
        catalog: context.catalog,
        ...(options.productId !== undefined ? { productId: options.productId } : {}),
        ...(options.categorySlug !== undefined ? { categorySlug: options.categorySlug } : {}),
        ...(options.excludeIds ? { excludeIds: options.excludeIds } : {}),
        ...(options.filter ? { filter: options.filter } : {}),
      };
      const pending = provider.recommend(request);
      if (results.size >= MAX_CACHE_ENTRIES) results.delete(results.keys().next().value as string);
      results.set(key, pending);
      // A failed call must not be cached, or the rail could never recover.
      pending.catch(() => results.delete(key));
      return pending;
    },

    clearCache() {
      results.clear();
      signalCache.clear();
    },

    getPersonalized: (context, options) => service.recommend("personalized", context, options),
    getSimilar: (productId, context, options) => service.recommend("similar", context, { ...options, productId }),
    getTrending: (context, options) => service.recommend("trending", context, options),
    getFrequentlyBoughtTogether: (productId, context, options) => service.recommend("frequently-bought-together", context, { ...options, productId }),
  };
  return service;
}

export const recommendationService: RecommendationService = createRecommendationService(mockRecommendationEngine);
