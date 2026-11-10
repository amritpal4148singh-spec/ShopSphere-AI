import { trendingCategoryBoost } from "./mock-data";
import type { Product } from "@/types/product";

export interface PopularityContext {
  minCreated: number;
  maxCreated: number;
}

export function popularityContext(catalog: readonly Product[]): PopularityContext {
  const dates = catalog.map((product) => product.createdAt).filter((value): value is number => value !== null);
  return { minCreated: dates.length ? Math.min(...dates) : 0, maxCreated: dates.length ? Math.max(...dates) : 0 };
}

/** Small deterministic tie-breaker in 0..1, so the same product always gets the same value. */
function jitter(id: number): number {
  return (Math.abs(Math.imul(id, 2654435761)) % 1000) / 999;
}

/**
 * Simulated popularity (PRD "mock popularity/rating velocity"): rating, discount, how new the product is, and a
 * simulated category boost. Weights add up to 1, so the result is in 0..1. Deterministic.
 */
export function popularityScore(product: Product, context: PopularityContext): number {
  const span = context.maxCreated - context.minCreated;
  const recency = product.createdAt !== null && span > 0 ? (product.createdAt - context.minCreated) / span : 0.5;
  return (
    0.45 * (product.rating / 5) +
    0.2 * Math.min(1, product.discountPercentage / 25) +
    0.15 * recency +
    0.15 * trendingCategoryBoost(product.category) +
    0.05 * jitter(product.id)
  );
}
