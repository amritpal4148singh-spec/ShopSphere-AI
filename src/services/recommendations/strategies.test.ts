import { buildCatalog, rawActivity } from "@/test/catalog";
import { assembleSignals } from "./signals";
import { runStrategy } from "./mock-engine";
import { EMPTY_RAW_SIGNALS, PRD_STRATEGIES, type RecommendationResult, type StrategyId } from "./types";

const catalog = buildCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;

type Activity = Parameters<typeof rawActivity>[1];

function run(strategy: StrategyId, activity: Activity = {}, extra: { productId?: number; categorySlug?: string; excludeIds?: number[]; limit?: number } = {}): RecommendationResult {
  const signals = assembleSignals(rawActivity(catalog, activity), catalog);
  return runStrategy({ strategy, limit: extra.limit ?? 12, signals, catalog, ...extra });
}

const ids = (result: RecommendationResult) => result.items.map((item) => item.product.id);

const rich: Activity = { viewed: [1, 2, 3], wishlist: [17], cart: [8], orders: [[8, 12]], searches: ["shoes"] };

describe("recently viewed (1)", () => {
  it("lists viewed products, most recent first", () => {
    expect(ids(run("recently-viewed", { viewed: [1, 2, 3] }))).toEqual([3, 2, 1]);
  });

  it("keeps an out-of-stock product visible, because it was viewed", () => {
    expect(ids(run("recently-viewed", { viewed: [1, 11] }))).toEqual([11, 1]);
  });

  it("is empty with no history and respects the limit and excluded ids", () => {
    expect(ids(run("recently-viewed"))).toEqual([]);
    expect(ids(run("recently-viewed", { viewed: [1, 2, 3] }, { limit: 2 }))).toEqual([3, 2]);
    expect(ids(run("recently-viewed", { viewed: [1, 2, 3] }, { excludeIds: [3] }))).toEqual([2, 1]);
  });

  it("is headed 'Recently Viewed'", () => {
    expect(run("recently-viewed", { viewed: [1] }).heading).toBe("Recently Viewed");
  });
});

describe("similar products (2)", () => {
  it("ranks products of the same category and tags first, and never includes the anchor", () => {
    const result = run("similar", {}, { productId: 1 });
    expect(ids(result)).not.toContain(1);
    expect(ids(result)[0]).toBe(2); // same category, shared tags "running" and "shoes", close price
    expect(result.items.slice(0, 4).every((item) => item.product.category === "mens-shoes")).toBe(true);
  });

  it("explains itself with the category and shared tags", () => {
    const top = run("similar", {}, { productId: 1 }).items[0]!;
    expect(top.reasons.join(" | ")).toContain("Same category: Mens Shoes");
    expect(top.reasons.join(" | ")).toContain("Shares tags");
  });

  it("never recommends an unrelated product just because it is popular", () => {
    expect(ids(run("similar", {}, { productId: 1 }))).not.toContain(22);
  });

  it("is empty for an unknown product", () => {
    expect(ids(run("similar", {}, { productId: 99999 }))).toEqual([]);
  });

  it("is headed 'Similar Products'", () => {
    expect(run("similar", {}, { productId: 1 }).heading).toBe("Similar Products");
  });
});

describe("category based (3)", () => {
  it("uses the shopper's dominant category and skips what they already viewed", () => {
    const result = run("category-based", { viewed: [1, 2, 3] });
    expect(result.heading).toBe("Because You Browsed Mens Shoes");
    expect(ids(result).sort()).toEqual([4, 5]);
  });

  it("is anchored to a given category, as on a category page, and then keeps viewed items", () => {
    const result = run("category-based", { viewed: [1, 2, 3] }, { categorySlug: "womens-shoes" });
    expect(result.heading).toBe("More in Womens Shoes");
    expect(ids(result).sort()).toEqual([6, 7]);
    expect(ids(run("category-based", { viewed: [1] }, { categorySlug: "mens-shoes" }))).toContain(1);
  });

  it("is empty when there is no browsing and no anchor", () => {
    expect(ids(run("category-based"))).toEqual([]);
  });

  it("orders by rating within the category", () => {
    const list = run("category-based", {}, { categorySlug: "mens-shoes" });
    expect(ids(list)[0]).toBe(3); // 4.8
  });
});

describe("price based (4)", () => {
  it("only offers products inside the shopper's typical price range", () => {
    const signals = assembleSignals(rawActivity(catalog, { viewed: [1, 2, 3] }), catalog);
    const result = run("price-based", { viewed: [1, 2, 3] });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.product.finalPrice).toBeGreaterThanOrEqual(signals.priceBand!.min);
      expect(item.product.finalPrice).toBeLessThanOrEqual(signals.priceBand!.max);
    }
  });

  it("names the range in its heading and excludes items already viewed", () => {
    const result = run("price-based", { viewed: [1, 2, 3] });
    expect(result.heading).toMatch(/^In Your Price Range \(₹[\d,]+ to ₹[\d,]+\)$/);
    expect(ids(result)).not.toContain(1);
  });

  it("is empty when there is no price information", () => {
    expect(ids(run("price-based"))).toEqual([]);
  });
});

describe("wishlist based (5)", () => {
  it("is empty for an empty wishlist", () => {
    expect(ids(run("wishlist-based"))).toEqual([]);
  });

  it("offers products related to the wishlist, never the wishlisted products themselves", () => {
    const result = run("wishlist-based", { wishlist: [17] });
    expect(ids(result)).not.toContain(17);
    expect(ids(result).slice(0, 2).every((id) => find(id).category === "beauty")).toBe(true);
    expect(result.items[0]!.reasons[0]).toBe("Similar to P17 on your wishlist");
    expect(result.heading).toBe("Inspired By Your Wishlist");
  });
});

describe("cart based (6)", () => {
  it("is empty for an empty cart", () => {
    expect(ids(run("cart-based"))).toEqual([]);
  });

  it("suggests complementary products, such as accessories for a phone, and not the cart item", () => {
    const result = run("cart-based", { cart: [8] });
    expect(ids(result)).not.toContain(8);
    expect(find(ids(result)[0]!).category).toBe("mobile-accessories");
    expect(result.items[0]!.reasons[0]).toBe("Goes with P8 in your cart");
    // No other phone: that would be a substitute, not an add-on.
    expect(result.items.every((item) => item.product.category !== "smartphones")).toBe(true);
    expect(result.heading).toBe("Goes Well With Your Cart");
  });
});

describe("frequently bought together (7)", () => {
  it("uses the simulated category pairs: a phone goes with accessories", () => {
    const result = run("frequently-bought-together", {}, { productId: 8 });
    expect(ids(result)).not.toContain(8);
    expect(find(ids(result)[0]!).category).toBe("mobile-accessories");
    expect(result.heading).toBe("Frequently Bought Together");
  });

  it("promotes products bought together in the shopper's own orders", () => {
    const result = run("frequently-bought-together", { orders: [[1, 22]] }, { productId: 1 });
    expect(ids(result)[0]).toBe(22);
    expect(result.items[0]!.reasons[0]).toBe("Bought together in your past orders");
  });

  it("keeps the rail varied by limiting one category to two items", () => {
    const result = run("frequently-bought-together", {}, { productId: 8 });
    const counts = new Map<string, number>();
    for (const item of result.items) counts.set(item.product.category, (counts.get(item.product.category) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it("is empty for an unknown product", () => {
    expect(ids(run("frequently-bought-together", {}, { productId: 99999 }))).toEqual([]);
  });
});

describe("trending (8)", () => {
  it("is available with no signals at all, and is headed 'Trending Now'", () => {
    const result = run("trending");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.heading).toBe("Trending Now");
    expect(result.fallback).toBe(false);
  });

  it("is sorted by simulated popularity and varied across categories", () => {
    const result = run("trending", {}, { limit: 20 });
    const scores = result.items.map((item) => item.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    const counts = new Map<string, number>();
    for (const item of result.items) counts.set(item.product.category, (counts.get(item.product.category) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
  });

  it("does not depend on the shopper", () => {
    expect(ids(run("trending", rich))).toEqual(ids(run("trending")));
  });
});

describe("personalized (9)", () => {
  it("falls back to popular products with no activity, and says so (PRD MOD-01-001, edge case 24)", () => {
    const result = run("personalized");
    expect(result.fallback).toBe(true);
    expect(result.heading).toBe("Popular Right Now");
    expect(ids(result)).toEqual(ids(run("trending")));
  });

  it("is headed 'Recommended For You' and excludes everything already viewed, saved, carted or bought", () => {
    const result = run("personalized", rich);
    expect(result.fallback).toBe(false);
    expect(result.heading).toBe("Recommended For You");
    for (const seen of [1, 2, 3, 17, 8, 12]) expect(ids(result)).not.toContain(seen);
  });

  it("reflects the shopper's categories and price range (PRD MOD-01-002)", () => {
    const result = run("personalized", { viewed: [1, 2], wishlist: [3], cart: [5] });
    expect(result.items[0]!.product.category).toBe("mens-shoes");
    expect(result.items[0]!.reasons.length).toBeGreaterThan(0);
  });

  it("gives every item a score in 0..1, ranked, with at most two reasons and a breakdown", () => {
    const result = run("personalized", rich);
    const scores = result.items.map((item) => item.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    for (const item of result.items) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(1);
      expect(item.reasons.length).toBeGreaterThan(0);
      expect(item.reasons.length).toBeLessThanOrEqual(2);
      expect(item.breakdown).toBeDefined();
    }
  });

  it("blends with popularity when there is little evidence, so one weak signal does not dominate (edge case 25)", () => {
    const result = run("personalized", { viewed: [22] }); // one grocery view
    expect(result.fallback).toBe(false);
    expect(result.confidence).toBeLessThan(0.2);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((item) => item.product.category !== "groceries")).toBe(true);
  });

  it("follows the shopper more as evidence grows", () => {
    const weak = run("personalized", { viewed: [1] });
    const strong = run("personalized", { viewed: [1, 2], wishlist: [3], cart: [5] });
    const shoes = (result: RecommendationResult) => result.items.slice(0, 3).filter((item) => item.product.category === "mens-shoes").length;
    expect(strong.confidence).toBeGreaterThan(weak.confidence);
    expect(shoes(strong)).toBeGreaterThanOrEqual(shoes(weak));
  });

  it("is deterministic", () => {
    expect(JSON.stringify(run("personalized", rich))).toBe(JSON.stringify(run("personalized", rich)));
  });

  it("lists the signals it used", () => {
    const used = run("personalized", rich).signalsUsed;
    for (const kind of ["viewed", "wishlist", "cart", "purchases", "search", "price"]) expect(used).toContain(kind);
  });
});

describe("featured (editorial)", () => {
  it("puts deals first, keeps categories varied, and is headed 'Featured Products'", () => {
    const result = run("featured", {}, { limit: 20 });
    expect(result.heading).toBe("Featured Products");
    expect(find(ids(result)[0]!).discountPercentage).toBeGreaterThanOrEqual(10);
    const counts = new Map<string, number>();
    for (const item of result.items) counts.set(item.product.category, (counts.get(item.product.category) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });
});

describe("across strategies", () => {
  const all: StrategyId[] = [...PRD_STRATEGIES];
  const activity = rich;

  function resultFor(strategy: StrategyId): RecommendationResult {
    return run(strategy, activity, { productId: 1, limit: 8 });
  }

  it("covers the nine PRD strategies", () => {
    expect(all).toHaveLength(9);
    expect(new Set(all).size).toBe(9);
  });

  it("produces visibly distinct output for each strategy given the same shopper", () => {
    const lists = all.map((strategy) => ({ strategy, ids: ids(resultFor(strategy)).join(",") }));
    for (let i = 0; i < lists.length; i++) {
      for (let j = i + 1; j < lists.length; j++) {
        expect(`${lists[i]!.strategy} vs ${lists[j]!.strategy}: ${lists[i]!.ids === lists[j]!.ids}`).toBe(`${lists[i]!.strategy} vs ${lists[j]!.strategy}: false`);
      }
    }
  });

  it("gives every strategy a signal-transparent heading", () => {
    const headings = all.map((strategy) => resultFor(strategy).heading);
    expect(new Set(headings).size).toBe(headings.length);
    for (const heading of headings) expect(heading.length).toBeGreaterThan(3);
  });

  it("never recommends an out-of-stock product, except in Recently Viewed (PRD edge case 23)", () => {
    const withOutOfStock: Activity = { ...rich, viewed: [1, 2, 3, 11] };
    for (const strategy of all) {
      const result = run(strategy, withOutOfStock, { productId: 8, limit: 20 });
      if (strategy === "recently-viewed") expect(ids(result)).toContain(11);
      else expect(ids(result)).not.toContain(11);
    }
    expect(ids(run("trending", {}, { limit: 50 }))).not.toContain(11);
    expect(ids(run("featured", {}, { limit: 50 }))).not.toContain(11);
  });

  it("respects the limit and never repeats a product within a rail", () => {
    for (const strategy of all) {
      const result = run(strategy, rich, { productId: 1, limit: 3 });
      expect(result.items.length).toBeLessThanOrEqual(3);
      expect(new Set(ids(result)).size).toBe(ids(result).length);
    }
  });

  it("copes with an empty catalogue", () => {
    for (const strategy of [...all, "featured" as StrategyId]) {
      const result = runStrategy({ strategy, limit: 8, signals: assembleSignals(EMPTY_RAW_SIGNALS, []), catalog: [] });
      expect(result.items).toEqual([]);
    }
  });
});
