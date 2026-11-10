import { buildCatalog, rawActivity, viewedOf } from "@/test/catalog";
import { EMPTY_RAW_SIGNALS } from "./types";
import { assembleSignals, derivePriceBand, fingerprintInputs } from "./signals";

const catalog = buildCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;

describe("assembleSignals with no activity", () => {
  it("has no evidence, no confidence and no profile (PRD edge case 24)", () => {
    const signals = assembleSignals(EMPTY_RAW_SIGNALS, catalog);
    expect(signals.evidence).toBe(0);
    expect(signals.confidence).toBe(0);
    expect(signals.priceBand).toBeNull();
    expect(signals.dominantCategory).toBeNull();
    expect(signals.viewedIds).toEqual([]);
    expect(signals.categoryAffinity).toEqual({});
  });
});

describe("viewed products", () => {
  it("are ordered most recent first and de-duplicated", () => {
    const raw = rawActivity(catalog, { viewed: [1, 2, 3, 2] });
    const signals = assembleSignals(raw, catalog);
    expect(signals.viewedIds).toEqual([2, 3, 1]);
    expect(signals.viewedProducts.map((product) => product.id)).toEqual([2, 3, 1]);
  });

  it("drop products that left the catalogue from the product list but still count their saved snapshot", () => {
    const ghost = { ...viewedOf(find(1), 9_999), productId: 9999 };
    const signals = assembleSignals({ ...EMPTY_RAW_SIGNALS, viewed: [ghost] }, catalog);
    expect(signals.viewedProducts).toEqual([]);
    expect(signals.viewedIds).toEqual([9999]);
    expect(signals.categoryAffinity["mens-shoes"]).toBe(1);
  });
});

describe("affinities", () => {
  it("normalize to 1 for the strongest category and rank others lower", () => {
    const signals = assembleSignals(rawActivity(catalog, { viewed: [1, 2, 3, 8] }), catalog);
    expect(signals.categoryAffinity["mens-shoes"]).toBe(1);
    expect(signals.categoryAffinity["smartphones"]).toBeLessThan(1);
    expect(signals.dominantCategory).toBe("mens-shoes");
  });

  it("weigh a recent view more than an older one", () => {
    const signals = assembleSignals(rawActivity(catalog, { viewed: [8, 1] }), catalog); // shoe viewed last
    expect(signals.categoryAffinity["mens-shoes"]).toBe(1);
    expect(Math.abs((signals.categoryAffinity["smartphones"] ?? 0) - 0.85) < 1e-9).toBe(true);
  });

  it("count a cart item for more than a view", () => {
    const signals = assembleSignals(rawActivity(catalog, { viewed: [1], cart: [8] }), catalog);
    expect(signals.dominantCategory).toBe("smartphones");
  });

  it("build tag and brand profiles", () => {
    const signals = assembleSignals(rawActivity(catalog, { viewed: [1, 2] }), catalog);
    expect(signals.tagAffinity["running"]).toBe(1);
    expect(signals.brandAffinity["Nike"]).toBe(1);
    expect(signals.tagAffinity["laptop"]).toBeUndefined();
  });
});

describe("derivePriceBand", () => {
  it("is null without prices", () => {
    expect(derivePriceBand([])).toBeNull();
  });

  it("widens a single price by 30 percent, rounded to 100", () => {
    expect(derivePriceBand([3000])).toEqual({ min: 2100, max: 3900 });
  });

  it("uses the middle of three or more prices with a 15 percent margin", () => {
    expect(derivePriceBand([2000, 3000, 4000])).toEqual({ min: 1700, max: 4600 });
  });

  it("ignores extreme outliers among many prices", () => {
    const band = derivePriceBand([2000, 2200, 2400, 2600, 2800, 90000]);
    expect(band!.max).toBeLessThan(10000);
  });
});

describe("price band from activity", () => {
  it("is built from viewed, wishlisted, carted and purchased prices", () => {
    const signals = assembleSignals(rawActivity(catalog, { viewed: [1], wishlist: [2], cart: [3] }), catalog);
    expect(signals.priceBand!.min).toBeLessThanOrEqual(2800);
    expect(signals.priceBand!.max).toBeGreaterThanOrEqual(3400);
  });
});

describe("search history", () => {
  it("points to the categories a search matches", () => {
    const signals = assembleSignals(rawActivity(catalog, { searches: ["running shoes"] }), catalog);
    expect(signals.searchCategories).toContain("mens-shoes");
    expect(signals.searchCategories).toContain("womens-shoes");
    expect(signals.searchCategories).not.toContain("smartphones");
    expect(signals.categoryAffinity["mens-shoes"]).toBeGreaterThan(0);
  });

  it("matches tags and category names, and ignores very short words", () => {
    expect(assembleSignals(rawActivity(catalog, { searches: ["phone"] }), catalog).searchCategories).toContain("smartphones");
    expect(assembleSignals(rawActivity(catalog, { searches: ["a to"] }), catalog).searchCategories).toEqual([]);
  });

  it("only looks at the three most recent searches", () => {
    const signals = assembleSignals(rawActivity(catalog, { searches: ["laptop", "phone", "perfume", "mascara"] }), catalog);
    expect(signals.searches).toHaveLength(3);
    expect(signals.searchCategories).not.toContain("beauty");
  });
});

describe("purchases", () => {
  it("record what was bought and what was bought together", () => {
    const signals = assembleSignals(rawActivity(catalog, { orders: [[8, 12], [8, 13]] }), catalog);
    expect(signals.purchasedIds.sort((a, b) => a - b)).toEqual([8, 12, 13]);
    expect([...(signals.coPurchases.get(8) ?? [])].sort((a, b) => a - b)).toEqual([12, 13]);
    expect([...(signals.coPurchases.get(12) ?? [])]).toEqual([8]);
  });
});

describe("evidence and confidence (PRD edge case 25)", () => {
  it("grows with activity and is capped at 1", () => {
    const one = assembleSignals(rawActivity(catalog, { viewed: [1] }), catalog);
    expect(one.evidence).toBe(1);
    expect(Math.abs(one.confidence - 1 / 6) < 1e-9).toBe(true);

    const lots = assembleSignals(rawActivity(catalog, { viewed: [1, 2], wishlist: [3], cart: [8], orders: [[12]], searches: ["shoes", "phone"] }), catalog);
    expect(lots.evidence).toBe(2 + 1.5 + 2 + 1.5 + 1);
    expect(lots.confidence).toBe(1);
  });

  it("reports how much of each signal there is", () => {
    const signals = assembleSignals(rawActivity(catalog, { viewed: [1, 2], wishlist: [3], cart: [8], searches: ["shoes"] }), catalog);
    expect(signals.counts).toEqual({ viewed: 2, searches: 1, wishlist: 1, cart: 1, purchases: 0 });
  });
});

describe("fingerprintInputs", () => {
  const raw = rawActivity(catalog, { viewed: [1, 2] });

  it("is stable for the same inputs and changes when activity changes", () => {
    expect(fingerprintInputs(raw, catalog)).toBe(fingerprintInputs(raw, catalog));
    expect(fingerprintInputs(rawActivity(catalog, { viewed: [1, 2, 3] }), catalog)).not.toBe(fingerprintInputs(raw, catalog));
    expect(fingerprintInputs(rawActivity(catalog, { viewed: [1, 2], cart: [8] }), catalog)).not.toBe(fingerprintInputs(raw, catalog));
  });

  it("changes when stock or price changes in the catalogue", () => {
    const changed = catalog.map((product) => (product.id === 1 ? { ...product, stock: 0 } : product));
    expect(fingerprintInputs(raw, changed)).not.toBe(fingerprintInputs(raw, catalog));
    const repriced = catalog.map((product) => (product.id === 1 ? { ...product, finalPrice: 1 } : product));
    expect(fingerprintInputs(raw, repriced)).not.toBe(fingerprintInputs(raw, catalog));
  });
});
