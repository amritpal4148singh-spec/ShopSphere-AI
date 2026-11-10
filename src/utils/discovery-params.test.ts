import { DEFAULT_DISCOVERY_STATE } from "./discovery";
import { parseDiscoveryParams, serializeDiscoveryParams } from "./discovery-params";

const parse = (query: string, options?: { fixedCategory?: string }) =>
  parseDiscoveryParams(new URLSearchParams(query), options);

describe("parseDiscoveryParams", () => {
  it("returns the defaults for an empty query string", () => {
    expect(parse("")).toEqual(DEFAULT_DISCOVERY_STATE);
  });

  it("reads every parameter", () => {
    const state = parse(
      "q=shoes&category=mens-shoes&category=womens-shoes&brand=Nike&minPrice=2000&maxPrice=5000&rating=4&availability=in&onSale=1&sort=price-asc&page=3",
    );
    expect(state).toEqual({
      query: "shoes",
      categories: ["mens-shoes", "womens-shoes"],
      brands: ["Nike"],
      minPrice: 2000,
      maxPrice: 5000,
      minRating: 4,
      availability: "in",
      onSale: true,
      sort: "price-asc",
      page: 3,
    });
  });

  it("swaps a reversed price range instead of producing a broken query (edge case 7)", () => {
    const state = parse("minPrice=5000&maxPrice=2000");
    expect(state.minPrice).toBe(2000);
    expect(state.maxPrice).toBe(5000);
  });

  it("falls back to defaults for invalid values", () => {
    const state = parse("minPrice=abc&maxPrice=-5&rating=9&availability=maybe&sort=cheapest&page=-2&onSale=yes");
    expect(state).toEqual(DEFAULT_DISCOVERY_STATE);
  });

  it("de-duplicates and trims list parameters", () => {
    expect(parse("brand=Nike&brand=Nike&brand=%20&category=a&category=a").brands).toEqual(["Nike"]);
    expect(parse("category=a&category=a").categories).toEqual(["a"]);
  });

  it("truncates an extremely long query (edge case 22)", () => {
    expect(parse(`q=${"x".repeat(500)}`).query).toHaveLength(100);
  });

  it("forces the category on a category page and ignores the category parameter", () => {
    expect(parse("category=laptops", { fixedCategory: "mens-shoes" }).categories).toEqual(["mens-shoes"]);
  });
});

describe("serializeDiscoveryParams", () => {
  it("omits defaults", () => {
    expect(serializeDiscoveryParams(DEFAULT_DISCOVERY_STATE).toString()).toBe("");
  });

  it("round-trips a full state", () => {
    const query =
      "q=shoes&category=mens-shoes&category=womens-shoes&brand=Nike&minPrice=2000&maxPrice=5000&rating=4&availability=out&onSale=1&sort=rating&page=2";
    expect(serializeDiscoveryParams(parse(query)).toString()).toBe(query);
  });

  it("leaves the category out on a category page", () => {
    const state = parse("", { fixedCategory: "mens-shoes" });
    expect(serializeDiscoveryParams(state, { fixedCategory: "mens-shoes" }).toString()).toBe("");
  });

  it("omits a bound that was cleared by setting it to undefined", () => {
    const state = { ...parse("minPrice=100&maxPrice=900"), minPrice: undefined };
    expect(serializeDiscoveryParams(state).toString()).toBe("maxPrice=900");
  });
});
