import { PRD_STRATEGIES, type StrategyId } from "@/services/recommendations";
import type { AnalyticsData, AnalyticsSummary, StrategyCounts, StrategyRow } from "@/types/analytics";

/** A clicked recommendation counts as converted if the product is added to the cart within this time (simulated rule). */
export const CONVERSION_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_PENDING_CLICKS = 50;

/** The nine PRD strategies, then the editorial Featured rail, which is not one of the nine but is also a recommendation rail. */
export const ANALYTICS_STRATEGIES: readonly StrategyId[] = [...PRD_STRATEGIES, "featured"];

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  "recently-viewed": "Recently Viewed",
  similar: "Similar Products",
  "category-based": "Category-Based",
  "price-based": "Price-Based",
  "wishlist-based": "Wishlist-Based",
  "cart-based": "Cart-Based",
  "frequently-bought-together": "Frequently Bought Together",
  trending: "Trending Products",
  personalized: "Personalized For You",
  featured: "Featured (editorial, not one of the nine)",
  assistant: "Shopping assistant",
};

export const ZERO_COUNTS: StrategyCounts = { impressions: 0, clicks: 0, conversions: 0 };

export function emptyAnalytics(now: number): AnalyticsData {
  return { since: now, counts: {}, pending: [], productViews: 0 };
}

function bump(data: AnalyticsData, strategy: StrategyId, change: Partial<StrategyCounts>): AnalyticsData["counts"] {
  const current = data.counts[strategy] ?? ZERO_COUNTS;
  return {
    ...data.counts,
    [strategy]: {
      impressions: current.impressions + (change.impressions ?? 0),
      clicks: current.clicks + (change.clicks ?? 0),
      conversions: current.conversions + (change.conversions ?? 0),
    },
  };
}

/** `count` product cards of a rail were shown. */
export function recordImpressions(data: AnalyticsData, strategy: StrategyId, count: number): AnalyticsData {
  return count <= 0 ? data : { ...data, counts: bump(data, strategy, { impressions: count }) };
}

/** A recommended product was clicked; it waits to see whether it is added to the cart. */
export function recordClick(data: AnalyticsData, strategy: StrategyId, productId: number, now: number): AnalyticsData {
  const pending = [...data.pending.filter((entry) => !(entry.productId === productId && entry.strategy === strategy)), { productId, strategy, at: now }].slice(-MAX_PENDING_CLICKS);
  return { ...data, counts: bump(data, strategy, { clicks: 1 }), pending };
}

/**
 * A product was added to the cart. If it was clicked from a recommendation within the window, that strategy gets one
 * conversion (the most recent click wins) and the waiting clicks for the product are cleared, so one path counts once.
 */
export function recordAddToCart(data: AnalyticsData, productId: number, now: number): AnalyticsData {
  const matches = data.pending.filter((entry) => entry.productId === productId && now - entry.at <= CONVERSION_WINDOW_MS);
  const expired = data.pending.filter((entry) => now - entry.at > CONVERSION_WINDOW_MS);
  const rest = data.pending.filter((entry) => entry.productId !== productId && !expired.includes(entry));
  const winner = matches.reduce<(typeof matches)[number] | null>((latest, entry) => (latest === null || entry.at > latest.at ? entry : latest), null);
  if (!winner) return rest.length === data.pending.length ? data : { ...data, pending: rest };
  return { ...data, counts: bump(data, winner.strategy, { conversions: 1 }), pending: rest };
}

export function recordProductView(data: AnalyticsData): AnalyticsData {
  return { ...data, productViews: data.productViews + 1 };
}

export function addCounts(a: StrategyCounts, b: StrategyCounts): StrategyCounts {
  return { impressions: a.impressions + b.impressions, clicks: a.clicks + b.clicks, conversions: a.conversions + b.conversions };
}

const ratio = (part: number, whole: number): number | null => (whole === 0 ? null : part / whole);

function toRow(strategy: StrategyId, counts: StrategyCounts): StrategyRow {
  return { strategy, ...counts, clickThroughRate: ratio(counts.clicks, counts.impressions), conversionRate: ratio(counts.conversions, counts.clicks) };
}

/**
 * Impressions, clicks and conversions per strategy plus totals (PRD 8.4). `baseline` is the simulated seed data
 * (src/data/analytics.json); pass it as null to see only what was tracked on this device. Rows are ordered by
 * engagement (clicks), most engaged first, so "popular recommendation types" reads top-down.
 */
export function summarizeAnalytics(tracked: Partial<Record<StrategyId, StrategyCounts>>, baseline: Partial<Record<StrategyId, StrategyCounts>> | null): AnalyticsSummary {
  const rows = ANALYTICS_STRATEGIES.map((strategy) => toRow(strategy, addCounts(tracked[strategy] ?? ZERO_COUNTS, baseline?.[strategy] ?? ZERO_COUNTS)));
  rows.sort((a, b) => b.clicks - a.clicks || b.conversions - a.conversions);
  const total = rows.reduce<StrategyCounts>(addCounts, ZERO_COUNTS);
  return { rows, totals: { ...total, clickThroughRate: ratio(total.clicks, total.impressions), conversionRate: ratio(total.conversions, total.clicks) } };
}

export function formatPercent(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}
