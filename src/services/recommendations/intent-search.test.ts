import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { rawActivity } from "@/test/catalog";
import { assembleSignals } from "./signals";
import { runStrategy } from "./mock-engine";
import { createRecommendationService } from "./service";
import { mockRecommendationEngine } from "./mock-engine";
import { EMPTY_RAW_SIGNALS, type ProductFilter, type RawSignals } from "./types";

const catalog = buildAssistantCatalog();

function search(filter: ProductFilter, raw: RawSignals = EMPTY_RAW_SIGNALS, limit = 8) {
  return runStrategy({ strategy: "assistant", filter, limit, signals: assembleSignals(raw, catalog), catalog });
}
const ids = (result: ReturnType<typeof search>) => result.items.map((item) => item.product.id);

describe('the "assistant" strategy (PRD 7.3)', () => {
  const headphones: ProductFilter = { keywords: ["headphone", "headset"], label: "headphones" };

  it("returns only products that pass the filter", () => {
    const result = search({ ...headphones, maxPrice: 5000 });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) expect(item.product.finalPrice).toBeLessThanOrEqual(5000);
    expect(ids(result)).not.toContain(105);
  });

  it("never offers an out-of-stock product (edge case 23)", () => {
    expect(ids(search(headphones))).not.toContain(106);
  });

  it("reports how many matched before the limit", () => {
    const result = search(headphones, EMPTY_RAW_SIGNALS, 2);
    expect(result.items).toHaveLength(2);
    expect(result.matched).toBe(5);
  });

  it("ranks by rating when asked", () => {
    const result = search({ ...headphones, sort: "rating" });
    const ratings = result.items.map((item) => item.product.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
  });

  it("sorts by price when asked", () => {
    const result = search({ ...headphones, sort: "price-asc" });
    const prices = result.items.map((item) => item.product.finalPrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("is deterministic", () => {
    expect(ids(search({ ...headphones, maxPrice: 5000 }))).toEqual(ids(search({ ...headphones, maxPrice: 5000 })));
  });

  it("gives every card a reason that names the filter it satisfied", () => {
    const result = search({ ...headphones, maxPrice: 5000, minRating: 4 });
    for (const item of result.items) {
      expect(item.reasons.length).toBeGreaterThan(0);
      expect(item.reasons.length).toBeLessThanOrEqual(2);
    }
    expect(result.items[0]?.reasons.join(" ")).toMatch(/budget|Rated/);
  });

  it("is not a fallback and is labelled for what it is", () => {
    const result = search(headphones);
    expect(result.fallback).toBe(false);
    expect(result.strategy).toBe("assistant");
    expect(result.signalsUsed).toContain("category");
  });

  it("returns nothing, rather than something unrelated, when nothing matches", () => {
    const result = search({ keywords: ["headphone"], maxPrice: 100 });
    expect(result.items).toEqual([]);
    expect(result.matched).toBe(0);
  });

  it("lets the shopper's own activity change the order, and says why", () => {
    const cold = ids(search({ categories: ["mens-shoes", "womens-shoes"] }));
    const warm = search({ categories: ["mens-shoes", "womens-shoes"] }, rawActivity(catalog, { viewed: [6, 7], wishlist: [6] }));
    expect(ids(warm)).not.toEqual(cold);
    expect(warm.items[0]?.product.category).toBe("womens-shoes");
  });
});

describe("the service caches the assistant strategy by its filter", () => {
  it("does not mix up two different filters", async () => {
    let calls = 0;
    const service = createRecommendationService({
      id: "counting",
      async recommend(request) {
        calls += 1;
        return mockRecommendationEngine.recommend(request);
      },
    });
    const context = { raw: EMPTY_RAW_SIGNALS, catalog };
    const cheap = await service.recommend("assistant", context, { filter: { keywords: ["headphone"], maxPrice: 2000 } });
    const dear = await service.recommend("assistant", context, { filter: { keywords: ["headphone"], maxPrice: 5000 } });
    const again = await service.recommend("assistant", context, { filter: { maxPrice: 5000, keywords: ["headphone"] } });

    expect(calls).toBe(2);
    expect(cheap.items.length).toBeLessThan(dear.items.length);
    expect(again).toBe(dear);
  });
});
