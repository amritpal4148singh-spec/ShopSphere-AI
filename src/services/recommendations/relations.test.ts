import { bandAround, complementarity, priceSimilarity, relatedness, tagAffinityScore, tagCosine } from "./relations";

describe("tagCosine", () => {
  it("is 1 for identical tags and 0 when nothing is shared", () => {
    expect(tagCosine(["a", "b"], ["a", "b"])).toBe(1);
    expect(tagCosine(["a"], ["b"])).toBe(0);
  });

  it("gives partial credit for partial overlap", () => {
    expect(Math.abs(tagCosine(["a", "b"], ["a"]) - 1 / Math.sqrt(2)) < 1e-9).toBe(true);
  });

  it("is 0 for an empty side and ignores duplicates", () => {
    expect(tagCosine([], ["a"])).toBe(0);
    expect(tagCosine(["a", "a"], ["a"])).toBe(1);
  });
});

describe("tagAffinityScore", () => {
  it("is 1 when the tags match the whole profile and lower for a partial match", () => {
    expect(Math.abs(tagAffinityScore(["a", "b"], { a: 1, b: 1 }) - 1) < 1e-9).toBe(true);
    expect(Math.abs(tagAffinityScore(["a"], { a: 1, b: 1 }) - 1 / Math.sqrt(2)) < 1e-9).toBe(true);
  });

  it("is 0 with no tags or no profile, and never above 1", () => {
    expect(tagAffinityScore([], { a: 1 })).toBe(0);
    expect(tagAffinityScore(["a"], {})).toBe(0);
    expect(tagAffinityScore(["a", "b", "c"], { a: 1, b: 1, c: 1 })).toBeLessThanOrEqual(1);
  });
});

describe("relatedness", () => {
  const base = { category: "mens-shoes", brand: "Nike", tags: ["running", "shoes"] };

  it("is 1 for the same category, brand and tags", () => {
    expect(relatedness(base, base)).toBe(1);
  });

  it("is 0 for products with nothing in common", () => {
    expect(relatedness(base, { category: "laptops", brand: "Dell", tags: ["laptop"] })).toBe(0);
  });

  it("counts category, tags and brand separately", () => {
    expect(relatedness(base, { category: "mens-shoes", brand: null, tags: [] })).toBe(0.5);
    expect(relatedness(base, { category: "laptops", brand: "Nike", tags: [] })).toBe(0.2);
  });
});

describe("priceSimilarity", () => {
  const band = { min: 2000, max: 4000 };

  it("is 1 inside the band and 0 with no band", () => {
    expect(priceSimilarity(2000, band)).toBe(1);
    expect(priceSimilarity(3000, band)).toBe(1);
    expect(priceSimilarity(4000, band)).toBe(1);
    expect(priceSimilarity(3000, null)).toBe(0);
  });

  it("falls off smoothly outside the band and reaches 0 far away", () => {
    const near = priceSimilarity(4300, band);
    const far = priceSimilarity(6000, band);
    expect(near).toBeLessThan(1);
    expect(near).toBeGreaterThan(far);
    expect(priceSimilarity(50000, band)).toBe(0);
  });
});

describe("bandAround and complementarity", () => {
  it("builds a band around a price", () => {
    expect(bandAround(1000, 0.3)).toEqual({ min: 700, max: 1300 });
  });

  it("rates a phone and its accessories as strongly complementary, and unrelated categories as not", () => {
    const phone = { category: "smartphones", brand: null, tags: [] };
    const accessory = { category: "mobile-accessories", brand: null, tags: [] };
    expect(complementarity(phone, accessory)).toBeGreaterThanOrEqual(0.9);
    expect(complementarity(phone, { category: "groceries", brand: null, tags: [] })).toBe(0);
  });
});
