import { buildCatalog, rawActivity } from "@/test/catalog";
import { createRecommendationService, recommendationService } from "./service";
import { EMPTY_RAW_SIGNALS, type RecommendationProvider, type RecommendationRequest, type RecommendationResult } from "./types";

const catalog = buildCatalog();

function fakeResult(request: RecommendationRequest, heading = "Fake"): RecommendationResult {
  return { strategy: request.strategy, items: [], heading, basedOn: "test", fallback: false, signalsUsed: [], confidence: 0 };
}

function countingProvider(heading = "Fake") {
  const state = { calls: 0, requests: [] as RecommendationRequest[] };
  const provider: RecommendationProvider = {
    id: "counting",
    async recommend(request) {
      state.calls += 1;
      state.requests.push(request);
      return fakeResult(request, heading);
    },
  };
  return { provider, state };
}

const context = { raw: rawActivity(catalog, { viewed: [1, 2] }), catalog };

describe("recommendation service caching (PRD 6.4)", () => {
  it("answers an identical request from the cache", async () => {
    const { provider, state } = countingProvider();
    const service = createRecommendationService(provider);

    const first = await service.recommend("trending", context);
    const second = await service.recommend("trending", context);

    expect(state.calls).toBe(1);
    expect(second).toBe(first);
  });

  it("treats different strategies, anchors, categories, limits and exclusions as different requests", async () => {
    const { provider, state } = countingProvider();
    const service = createRecommendationService(provider);

    await service.recommend("similar", context, { productId: 1 });
    await service.recommend("similar", context, { productId: 2 });
    await service.recommend("category-based", context, { categorySlug: "mens-shoes" });
    await service.recommend("category-based", context, { categorySlug: "smartphones" });
    await service.recommend("similar", { ...context, limit: 3 }, { productId: 1 });
    await service.recommend("similar", context, { productId: 1, excludeIds: [5] });

    expect(state.calls).toBe(6);
  });

  it("does not care about the order of excluded ids", async () => {
    const { provider, state } = countingProvider();
    const service = createRecommendationService(provider);

    await service.recommend("similar", context, { productId: 1, excludeIds: [3, 4] });
    await service.recommend("similar", context, { productId: 1, excludeIds: [4, 3] });

    expect(state.calls).toBe(1);
  });

  it("recomputes when the shopper's activity changes", async () => {
    const { provider, state } = countingProvider();
    const service = createRecommendationService(provider);

    await service.recommend("personalized", context);
    await service.recommend("personalized", { ...context, raw: rawActivity(catalog, { viewed: [1, 2, 3] }) });

    expect(state.calls).toBe(2);
  });

  it("recomputes when stock or price changes in the catalogue", async () => {
    const { provider, state } = countingProvider();
    const service = createRecommendationService(provider);

    await service.recommend("trending", context);
    await service.recommend("trending", { ...context, catalog: catalog.map((product) => (product.id === 1 ? { ...product, stock: 0 } : product)) });

    expect(state.calls).toBe(2);
  });

  it("can be cleared", async () => {
    const { provider, state } = countingProvider();
    const service = createRecommendationService(provider);

    await service.recommend("trending", context);
    service.clearCache();
    await service.recommend("trending", context);

    expect(state.calls).toBe(2);
  });

  it("does not cache a failure, so a rail can recover (PRD edge case 16)", async () => {
    let calls = 0;
    const flaky: RecommendationProvider = {
      id: "flaky",
      async recommend(request) {
        calls += 1;
        if (calls === 1) throw new Error("provider down");
        return fakeResult(request);
      },
    };
    const service = createRecommendationService(flaky);

    let failed = false;
    try {
      await service.recommend("trending", context);
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);

    const retry = await service.recommend("trending", context);
    expect(retry.heading).toBe("Fake");
    expect(calls).toBe(2);
  });
});

describe("the provider boundary (PRD 6.4)", () => {
  it("passes the assembled signals, the catalogue and the options to the provider", async () => {
    const { provider, state } = countingProvider();
    await createRecommendationService(provider).recommend("similar", context, { productId: 7, excludeIds: [9] });

    const request = state.requests[0]!;
    expect(request.strategy).toBe("similar");
    expect(request.productId).toBe(7);
    expect(request.excludeIds).toEqual([9]);
    expect(request.limit).toBe(8);
    expect(request.catalog).toBe(catalog);
    expect(request.signals.viewedIds).toEqual([2, 1]);
  });

  it("works with any other provider, which is what makes the engine replaceable", async () => {
    const replacement: RecommendationProvider = {
      id: "ml-stand-in",
      async recommend(request) {
        return { ...fakeResult(request, "From a different engine"), items: [{ product: catalog[0]!, score: 1, reasons: ["Chosen by another engine"] }] };
      },
    };
    const result = await createRecommendationService(replacement).recommend("personalized", context);

    expect(result.heading).toBe("From a different engine");
    expect(result.items[0]?.reasons).toEqual(["Chosen by another engine"]);
  });

  it("keeps different providers' results apart", async () => {
    const a = countingProvider("A");
    const b = countingProvider("B");
    const serviceA = createRecommendationService(a.provider);
    const serviceB = createRecommendationService(b.provider);

    expect((await serviceA.recommend("trending", context)).heading).toBe("A");
    expect((await serviceB.recommend("trending", context)).heading).toBe("B");
  });
});

describe("the default service (mock engine)", () => {
  it("gives popular products to someone with no activity", async () => {
    const result = await recommendationService.recommend("personalized", { raw: EMPTY_RAW_SIGNALS, catalog });
    expect(result.fallback).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("derives signals once per set of inputs", () => {
    const first = recommendationService.signals(context);
    expect(recommendationService.signals(context)).toBe(first);
    expect(first.viewedIds).toEqual([2, 1]);
  });

  it("limits rails to eight products unless told otherwise", async () => {
    const result = await recommendationService.recommend("trending", { raw: EMPTY_RAW_SIGNALS, catalog });
    expect(result.items.length).toBeLessThanOrEqual(8);
  });

  it("exposes a fingerprint that changes with the inputs", () => {
    expect(recommendationService.fingerprint(context)).not.toBe(recommendationService.fingerprint({ ...context, raw: rawActivity(catalog, { viewed: [1] }) }));
  });
});

describe("named entry points (PRD 6.4)", () => {
  it("delegate to recommend() with the right strategy and seed, without logic of their own", async () => {
    const { provider, state } = countingProvider();
    const service = createRecommendationService(provider);
    await service.getPersonalized(context);
    await service.getSimilar(7, context);
    await service.getTrending(context);
    await service.getFrequentlyBoughtTogether(9, context);

    expect(state.requests.map((request) => request.strategy)).toEqual(["personalized", "similar", "trending", "frequently-bought-together"]);
    expect(state.requests[1]).toMatchObject({ productId: 7 });
    expect(state.requests[3]).toMatchObject({ productId: 9 });
    expect(state.requests[0]).not.toHaveProperty("productId");
  });
});
