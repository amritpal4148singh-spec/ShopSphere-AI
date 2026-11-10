import { buildCatalog, rawActivity } from "@/test/catalog";
import { PERSONALIZED_WEIGHTS } from "./constants";
import { popularityContext, popularityScore } from "./popularity";
import { compositeScore, explain, scoreComponents } from "./scoring";
import { assembleSignals } from "./signals";

const catalog = buildCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;
const context = popularityContext(catalog);
const pop = (id: number) => popularityScore(find(id), context);

const rich = assembleSignals(rawActivity(catalog, { viewed: [1, 2], wishlist: [3], cart: [8], searches: ["shoes"] }), catalog);

describe("score weights (PRD 6.2)", () => {
  it("add up to 1, so a score is always in 0..1", () => {
    const total = Object.values(PERSONALIZED_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(Math.abs(total - 1) < 1e-9).toBe(true);
  });

  it("includes the PRD's seven components", () => {
    for (const name of ["categoryMatch", "priceSimilarity", "tagOverlap", "normalizedRating", "recentlyViewedRelation", "wishlistRelation", "cartRelation"]) {
      expect(PERSONALIZED_WEIGHTS[name as keyof typeof PERSONALIZED_WEIGHTS]).toBeGreaterThan(0);
    }
  });
});

describe("scoreComponents", () => {
  it("returns every component in 0..1 for every product", () => {
    for (const product of catalog) {
      const breakdown = scoreComponents(product, rich, pop(product.id));
      for (const value of Object.values(breakdown)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      const total = compositeScore(breakdown);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(1);
    }
  });

  it("rates a product in the shopper's favourite category higher than an unrelated one", () => {
    const shoe = scoreComponents(find(4), rich, pop(4));
    const grocery = scoreComponents(find(22), rich, pop(22));
    expect(shoe.categoryMatch).toBeGreaterThan(grocery.categoryMatch);
    expect(compositeScore(shoe)).toBeGreaterThan(compositeScore(grocery));
  });

  it("rewards a price inside the shopper's range and the right tags", () => {
    const sameRange = scoreComponents(find(7), rich, pop(7));
    expect(sameRange.priceSimilarity).toBe(1);
    expect(sameRange.tagOverlap).toBeGreaterThan(0);
  });

  it("relates a product to what was viewed, saved and carted", () => {
    const shoe = scoreComponents(find(5), rich, pop(5)); // casual shoe
    expect(shoe.recentlyViewedRelation).toBeGreaterThan(0);
    expect(shoe.wishlistRelation).toBeGreaterThan(0);
    const accessory = scoreComponents(find(12), rich, pop(12)); // phone case, goes with the phone in the cart
    expect(accessory.cartRelation).toBeGreaterThanOrEqual(0.9);
  });

  it("does not relate a product to itself", () => {
    expect(scoreComponents(find(1), rich, pop(1)).recentlyViewedRelation).toBeLessThan(1);
  });

  it("uses the brand profile", () => {
    expect(scoreComponents(find(2), rich, pop(2)).brandAffinity).toBeGreaterThan(0);
    expect(scoreComponents(find(15), rich, pop(15)).brandAffinity).toBe(0);
    expect(scoreComponents(find(22), rich, pop(22)).brandAffinity).toBe(0);
  });
});

describe("explain (every recommendation traces to a signal)", () => {
  it("names the actual viewed product, price range, wishlist item or cart item", () => {
    const shoeReasons = explain(find(5), scoreComponents(find(5), rich, pop(5)), rich).join(" | ");
    expect(shoeReasons).toMatch(/P1|P2|P3|Mens Shoes|shoes|price range/);

    const caseReasons = explain(find(12), scoreComponents(find(12), rich, pop(12)), rich).join(" | ");
    expect(caseReasons).toContain("P8");
  });

  it("gives at most two reasons, never an empty list", () => {
    for (const product of catalog) {
      const reasons = explain(product, scoreComponents(product, rich, pop(product.id)), rich);
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons.length).toBeLessThanOrEqual(2);
    }
  });

  it("states the price range in rupees", () => {
    const reasons = explain(find(7), scoreComponents(find(7), rich, pop(7)), rich).join(" | ");
    expect(reasons).toMatch(/₹/);
  });

  it("falls back to a popularity reason when nothing is known", () => {
    const none = assembleSignals(rawActivity(catalog, {}), catalog);
    expect(explain(find(22), scoreComponents(find(22), none, 0), none)).toEqual(["Popular with shoppers"]);
  });
});
