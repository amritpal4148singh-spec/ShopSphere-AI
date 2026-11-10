import { PERSONALIZED_WEIGHTS } from "./constants";

/** Pins the documented weights (README and docs/RECOMMENDATIONS.md). Changing one is a deliberate act that must update both. */
describe("personalized score weights (PRD 6.2)", () => {
  it("are exactly the documented values", () => {
    expect(PERSONALIZED_WEIGHTS).toEqual({
      categoryMatch: 0.22,
      priceSimilarity: 0.12,
      tagOverlap: 0.14,
      normalizedRating: 0.1,
      recentlyViewedRelation: 0.16,
      wishlistRelation: 0.08,
      cartRelation: 0.08,
      brandAffinity: 0.06,
      popularity: 0.04,
    });
  });
});
