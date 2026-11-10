import type { AnalyticsData } from "@/types/analytics";
import {
  ANALYTICS_STRATEGIES,
  CONVERSION_WINDOW_MS,
  MAX_PENDING_CLICKS,
  emptyAnalytics,
  formatPercent,
  recordAddToCart,
  recordClick,
  recordImpressions,
  recordProductView,
  summarizeAnalytics,
} from "./analytics";

const T0 = 1_700_000_000_000;

describe("recording events (PRD 8.4)", () => {
  it("counts impressions per strategy and ignores empty rails", () => {
    let data = recordImpressions(emptyAnalytics(T0), "similar", 4);
    data = recordImpressions(data, "similar", 2);
    data = recordImpressions(data, "trending", 8);
    expect(data.counts.similar?.impressions).toBe(6);
    expect(data.counts.trending?.impressions).toBe(8);
    const same = recordImpressions(data, "cart-based", 0);
    expect(same).toBe(data);
  });

  it("counts a click and remembers it until the product is added to the cart", () => {
    const data = recordClick(emptyAnalytics(T0), "similar", 5, T0);
    expect(data.counts.similar?.clicks).toBe(1);
    expect(data.pending).toEqual([{ productId: 5, strategy: "similar", at: T0 }]);
  });

  it("counts a conversion for the strategy whose click led to the add-to-cart, once", () => {
    let data = recordClick(emptyAnalytics(T0), "similar", 5, T0);
    data = recordAddToCart(data, 5, T0 + 60_000);
    expect(data.counts.similar).toEqual({ impressions: 0, clicks: 1, conversions: 1 });
    expect(data.pending).toEqual([]);
    // Adding the same product again is not a second conversion.
    expect(recordAddToCart(data, 5, T0 + 120_000).counts.similar?.conversions).toBe(1);
  });

  it("credits the most recent click when a product was clicked from two rails", () => {
    let data = recordClick(emptyAnalytics(T0), "similar", 5, T0);
    data = recordClick(data, "trending", 5, T0 + 1000);
    data = recordAddToCart(data, 5, T0 + 2000);
    expect(data.counts.trending?.conversions).toBe(1);
    expect(data.counts.similar?.conversions ?? 0).toBe(0);
    expect(data.pending).toEqual([]);
  });

  it("does not count an add-to-cart of a product that was never clicked from a rail, or whose click expired", () => {
    const data = recordClick(emptyAnalytics(T0), "similar", 5, T0);
    expect(recordAddToCart(data, 6, T0 + 10).counts.similar?.conversions ?? 0).toBe(0);
    const late = recordAddToCart(data, 5, T0 + CONVERSION_WINDOW_MS + 1);
    expect(late.counts.similar?.conversions ?? 0).toBe(0);
    expect(late.pending).toEqual([]);
  });

  it("keeps the waiting list bounded", () => {
    let data: AnalyticsData = emptyAnalytics(T0);
    for (let id = 1; id <= MAX_PENDING_CLICKS + 10; id += 1) data = recordClick(data, "similar", id, T0 + id);
    expect(data.pending).toHaveLength(MAX_PENDING_CLICKS);
    expect(data.pending[0]?.productId).toBe(11);
  });

  it("counts product page views", () => {
    expect(recordProductView(recordProductView(emptyAnalytics(T0))).productViews).toBe(2);
  });
});

describe("summarizeAnalytics", () => {
  const tracked = { similar: { impressions: 10, clicks: 5, conversions: 2 }, trending: { impressions: 20, clicks: 1, conversions: 0 } };
  const baseline = { similar: { impressions: 90, clicks: 15, conversions: 3 } };

  it("lists the nine PRD strategies plus Featured, even with no activity", () => {
    const { rows } = summarizeAnalytics({}, null);
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.strategy).sort()).toEqual([...ANALYTICS_STRATEGIES].sort());
    expect(rows.every((row) => row.clickThroughRate === null && row.conversionRate === null)).toBe(true);
  });

  it("adds the baseline to the tracked counts, or leaves it out", () => {
    const withBaseline = summarizeAnalytics(tracked, baseline).rows.find((row) => row.strategy === "similar");
    expect(withBaseline).toMatchObject({ impressions: 100, clicks: 20, conversions: 5, clickThroughRate: 0.2, conversionRate: 0.25 });
    expect(summarizeAnalytics(tracked, null).rows.find((row) => row.strategy === "similar")).toMatchObject({ impressions: 10, clicks: 5 });
  });

  it("orders the strategies by engagement and totals them", () => {
    const summary = summarizeAnalytics(tracked, null);
    expect(summary.rows.slice(0, 2).map((row) => row.strategy)).toEqual(["similar", "trending"]);
    expect(summary.totals).toMatchObject({ impressions: 30, clicks: 6, conversions: 2 });
    expect(summary.totals.clickThroughRate).toBeCloseTo(0.2);
    expect(summary.totals.conversionRate).toBeCloseTo(1 / 3);
  });

  it("formats rates, with n/a when there is nothing to divide by", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatPercent(null)).toBe("n/a");
  });
});
