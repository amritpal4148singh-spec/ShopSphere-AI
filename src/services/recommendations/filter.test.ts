import { buildAssistantCatalog } from "@/test/assistant-catalog";
import { makeProduct } from "@/test/fixtures";
import { filterKey, hasColour, matchesFilter } from "./filter";

const catalog = buildAssistantCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;

describe("matchesFilter (the filter half of the assistant strategy)", () => {
  it("an empty filter matches everything", () => {
    expect(catalog.every((product) => matchesFilter(product, {}))).toBe(true);
  });

  it("matches by category slug", () => {
    expect(catalog.filter((product) => matchesFilter(product, { categories: ["smartphones"] })).map((product) => product.id)).toEqual([8, 9, 10, 11]);
  });

  it("matches a product type by keyword in the title or tags, not only by category", () => {
    const ids = catalog.filter((product) => matchesFilter(product, { keywords: ["headphone", "headset"] })).map((product) => product.id);
    expect(ids).toEqual([101, 102, 103, 104, 105, 106]);
  });

  it("matches keywords whatever their plural form", () => {
    expect(matchesFilter(find(101), { keywords: ["headphones"] })).toBe(true);
    expect(matchesFilter(find(8), { keywords: ["headphones"] })).toBe(false);
  });

  it("does not match keywords against descriptions", () => {
    const phone = makeProduct({ category: "smartphones", description: "No headphone jack." });
    expect(matchesFilter(phone, { keywords: ["headphone"] })).toBe(false);
  });

  it("accepts either a category or a keyword when both are given", () => {
    const filter = { categories: ["laptops"], keywords: ["headphone"] };
    expect(matchesFilter(find(15), filter)).toBe(true);
    expect(matchesFilter(find(102), filter)).toBe(true);
    expect(matchesFilter(find(8), filter)).toBe(false);
  });

  it("applies price and rating bounds inclusively, on the discounted price", () => {
    expect(matchesFilter(find(17), { maxPrice: 850 })).toBe(true);
    expect(matchesFilter(find(17), { maxPrice: 849 })).toBe(false);
    expect(matchesFilter(find(103), { minPrice: 4800 })).toBe(true);
    expect(matchesFilter(find(103), { minPrice: 4801 })).toBe(false);
    expect(matchesFilter(find(103), { minRating: 4.7 })).toBe(true);
    expect(matchesFilter(find(103), { minRating: 4.8 })).toBe(false);
  });

  it("combines every condition", () => {
    const filter = { keywords: ["headphone"], maxPrice: 5000, minRating: 4.4 };
    expect(catalog.filter((product) => matchesFilter(product, filter)).map((product) => product.id)).toEqual([102, 103, 106]);
  });
});

describe("hasColour", () => {
  it("finds a colour named in the title, description or tags", () => {
    expect(hasColour(find(104), "blue")).toBe(true);
    expect(hasColour(find(101), "blue")).toBe(false);
    expect(hasColour(makeProduct({ description: "Comes in a deep navy and red finish." }), "red")).toBe(true);
  });

  it("finds a colour offered by the simulated colour variants", () => {
    const watch = makeProduct({ id: 1, category: "mens-watches", stock: 30 });
    expect(hasColour(watch, "silver")).toBe(true);
    expect(hasColour(watch, "blue")).toBe(false);
  });

  it("ignores a colour variant that is sold out", () => {
    const soldOut = makeProduct({ id: 1, category: "mens-watches", stock: 0 });
    expect(hasColour(soldOut, "silver")).toBe(false);
  });
});

describe("filterKey", () => {
  it("is the same for the same filter, whatever the order", () => {
    expect(filterKey({ categories: ["b", "a"], maxPrice: 5 })).toBe(filterKey({ maxPrice: 5, categories: ["a", "b"] }));
  });

  it("differs when anything differs", () => {
    expect(filterKey({ maxPrice: 5 })).not.toBe(filterKey({ maxPrice: 6 }));
    expect(filterKey({ colour: "blue" })).not.toBe(filterKey({}));
    expect(filterKey({ sort: "rating" })).not.toBe(filterKey({}));
  });
});
