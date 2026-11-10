import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useCatalog } from "@/features/products";
import { recommendationService, type RecommendationResult, type StrategyId } from "@/services/recommendations";
import { useRawSignals } from "./use-raw-signals";

export interface RecommendationOptions {
  strategy: StrategyId;
  /** The product a product-page strategy is anchored to. */
  productId?: number;
  /** A category a category-based rail is anchored to. */
  categorySlug?: string;
  excludeIds?: number[];
  limit?: number;
}

export type RecommendationState =
  | { status: "loading"; result: null }
  | { status: "unavailable"; result: null }
  | { status: "ready"; result: RecommendationResult };

/**
 * hook -> service -> provider -> engine (PRD 6.4). Collects the local signals and the cached catalogue, asks the
 * recommendation service, and re-asks whenever anything that affects the answer changes (activity, stock, price).
 * If the catalogue or the service fails, the state is "unavailable" and callers hide the rail (PRD edge case 16).
 */
export function useRecommendations(options: RecommendationOptions): RecommendationState {
  const catalog = useCatalog();
  const raw = useRawSignals();
  const { strategy, productId, categorySlug, excludeIds, limit } = options;

  const context = useMemo(() => (catalog.data ? { raw, catalog: catalog.data, ...(limit !== undefined ? { limit } : {}) } : null), [raw, catalog.data, limit]);
  const fingerprint = useMemo(() => (context ? recommendationService.fingerprint(context) : ""), [context]);
  const excludeKey = (excludeIds ?? []).join(",");

  const query = useQuery({
    queryKey: ["recommendations", strategy, productId ?? null, categorySlug ?? null, excludeKey, limit ?? null, fingerprint],
    queryFn: () => {
      if (!context) throw new Error("The catalogue is not loaded.");
      return recommendationService.recommend(strategy, context, {
        ...(productId !== undefined ? { productId } : {}),
        ...(categorySlug !== undefined ? { categorySlug } : {}),
        ...(excludeIds ? { excludeIds } : {}),
      });
    },
    enabled: context !== null,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });

  if (catalog.isError || query.isError) return { status: "unavailable", result: null };
  if (query.data) return { status: "ready", result: query.data };
  return { status: "loading", result: null };
}
