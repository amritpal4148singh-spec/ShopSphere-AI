import fixture from "@/data/user-preferences.json";
import { SEED_CUSTOMER_ID } from "@/data/seed-data";
import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { rawActivity } from "@/test/catalog";
import { EMPTY_RAW_SIGNALS } from "./types";
import { assembleSignals } from "./signals";
import { toDerivedPreferences, type DerivedPreferences } from "./preferences";

describe("user-preferences fixture (PRD 10.3)", () => {
  it("has the shape that toDerivedPreferences produces, for the demo customer", () => {
    const profile = fixture.profiles[0]!;
    expect(profile.userId).toBe(SEED_CUSTOMER_ID);
    const sample: DerivedPreferences = toDerivedPreferences(assembleSignals(EMPTY_RAW_SIGNALS, buildAssistantCatalog()));
    const { userId, ...fixtureShape } = profile;
    void userId;
    expect(Object.keys(fixtureShape).sort()).toEqual(Object.keys(sample).sort());
    expect(fixtureShape.priceBand.min).toBeLessThan(fixtureShape.priceBand.max);
    expect(fixtureShape.confidence).toBeGreaterThanOrEqual(0);
    expect(fixtureShape.confidence).toBeLessThanOrEqual(1);
  });

  it("derives a summary from real activity and is empty for a new shopper", () => {
    const empty = toDerivedPreferences(assembleSignals(EMPTY_RAW_SIGNALS, buildAssistantCatalog()));
    expect(empty).toEqual({ priceBand: null, preferredCategories: [], preferredBrands: [], recentSearches: [], confidence: 0 });

    const catalog = buildAssistantCatalog();
    const activity = toDerivedPreferences(assembleSignals(rawActivity(catalog, { viewed: [101, 102], searches: ["headphones"] }), catalog));
    expect(activity.preferredCategories).toContain("mobile-accessories");
    expect(activity.recentSearches).toEqual(["headphones"]);
    expect(activity.confidence).toBeGreaterThan(0);
  });
});
