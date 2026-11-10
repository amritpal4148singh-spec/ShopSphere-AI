import type { StrategyId } from "@/services/recommendations";

/** Counters for one recommendation strategy (PRD 8.4). */
export interface StrategyCounts {
  impressions: number;
  clicks: number;
  conversions: number;
}

/** A clicked recommendation waiting to see whether it leads to an add-to-cart. */
export interface PendingClick {
  productId: number;
  strategy: StrategyId;
  /** Epoch milliseconds. */
  at: number;
}

/** Locally tracked recommendation analytics for this device (PRD 8.4: never an external pipeline). */
export interface AnalyticsData {
  /** Epoch milliseconds when tracking began (or was last reset). */
  since: number;
  counts: Partial<Record<StrategyId, StrategyCounts>>;
  pending: PendingClick[];
  /** Product pages viewed on this device, the visit count behind the simulated conversion rate. */
  productViews: number;
}

export interface StrategyRow extends StrategyCounts {
  strategy: StrategyId;
  /** clicks / impressions, or null when nothing was shown. */
  clickThroughRate: number | null;
  /** conversions / clicks, or null when nothing was clicked. */
  conversionRate: number | null;
}

export interface AnalyticsSummary {
  rows: StrategyRow[];
  totals: StrategyCounts & { clickThroughRate: number | null; conversionRate: number | null };
}
