import type { PriceBand, ShopperSignals } from "./types";

/**
 * A compact, serialisable summary of the signals derived for one shopper: the structure PRD 10.3 asks a
 * "user-preferences" fixture to show. It is computed on demand from `ShopperSignals`, never stored, so it cannot go stale.
 */
export interface DerivedPreferences {
  priceBand: PriceBand | null;
  /** Category slugs, strongest affinity first. */
  preferredCategories: string[];
  preferredBrands: string[];
  recentSearches: string[];
  /** 0 (nothing known) to 1 (plenty of evidence). */
  confidence: number;
}

const strongest = (affinity: Record<string, number>, limit: number): string[] =>
  Object.entries(affinity)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);

export function toDerivedPreferences(signals: ShopperSignals, limit = 3): DerivedPreferences {
  return {
    priceBand: signals.priceBand,
    preferredCategories: strongest(signals.categoryAffinity, limit),
    preferredBrands: strongest(signals.brandAffinity, limit),
    recentSearches: signals.searches.slice(0, limit),
    confidence: Math.round(signals.confidence * 100) / 100,
  };
}
