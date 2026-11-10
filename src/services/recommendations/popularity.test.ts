import { buildCatalog } from "@/test/catalog";
import { makeProduct } from "@/test/fixtures";
import { popularityContext, popularityScore } from "./popularity";

describe("popularityScore (simulated)", () => {
  const catalog = buildCatalog();
  const context = popularityContext(catalog);

  it("stays between 0 and 1 for every product", () => {
    for (const product of catalog) {
      const score = popularityScore(product, context);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic", () => {
    const product = catalog[0]!;
    expect(popularityScore(product, context)).toBe(popularityScore(product, context));
  });

  it("rises with rating, all else equal", () => {
    const low = makeProduct({ id: 500, rating: 3, category: "groceries", discountPercentage: 0, createdAt: 1 });
    const high = makeProduct({ id: 500, rating: 5, category: "groceries", discountPercentage: 0, createdAt: 1 });
    expect(popularityScore(high, context)).toBeGreaterThan(popularityScore(low, context));
  });

  it("rises with discount and with a simulated trending category", () => {
    const plain = makeProduct({ id: 501, rating: 4, category: "groceries", discountPercentage: 0, createdAt: 1 });
    const sale = makeProduct({ id: 501, rating: 4, category: "groceries", discountPercentage: 25, createdAt: 1 });
    const hot = makeProduct({ id: 501, rating: 4, category: "smartphones", discountPercentage: 0, createdAt: 1 });
    expect(popularityScore(sale, context)).toBeGreaterThan(popularityScore(plain, context));
    expect(popularityScore(hot, context)).toBeGreaterThan(popularityScore(plain, context));
  });

  it("copes with products without a creation date and with an empty catalogue", () => {
    const undated = makeProduct({ id: 502, createdAt: null });
    expect(Number.isFinite(popularityScore(undated, context))).toBe(true);
    expect(popularityContext([])).toEqual({ minCreated: 0, maxCreated: 0 });
  });
});
