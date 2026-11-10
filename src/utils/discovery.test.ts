import { makeProduct } from "@/test/fixtures";
import {
  DEFAULT_DISCOVERY_STATE,
  applyFilters,
  clearAllFilters,
  getActiveFilters,
  getBrandOptions,
  getPageItems,
  getPriceBounds,
  isOnSale,
  paginate,
  removeFilter,
  sortProducts,
} from "./discovery";
import type { DiscoveryState } from "@/types/product";

const state = (overrides: Partial<DiscoveryState> = {}): DiscoveryState => ({ ...DEFAULT_DISCOVERY_STATE, ...overrides });
const titles = (products: { title: string }[]) => products.map((product) => product.title);

const catalogue = [
  makeProduct({ id: 1, title: "A", category: "mens-shoes", brand: "Nike", finalPrice: 3000, rating: 4.5 }),
  makeProduct({ id: 2, title: "B", category: "mens-shoes", brand: "Puma", finalPrice: 4500, rating: 4.1 }),
  makeProduct({ id: 3, title: "C", category: "womens-shoes", brand: "Nike", finalPrice: 1500, rating: 4.8 }),
  makeProduct({ id: 4, title: "D", category: "womens-shoes", brand: null, finalPrice: 2500, rating: 3.2 }),
  makeProduct({ id: 5, title: "E", category: "smartphones", brand: "Apple", finalPrice: 60000, rating: 4.9, availability: "out-of-stock", stock: 0 }),
  makeProduct({ id: 6, title: "F", category: "smartphones", brand: "Apple", finalPrice: 20000, rating: 4.0, discountPercentage: 15 }),
];

describe("applyFilters", () => {
  it("returns everything when no filter is active", () => {
    expect(applyFilters(catalogue, state())).toHaveLength(6);
  });

  it("filters by category (multi-select)", () => {
    expect(titles(applyFilters(catalogue, state({ categories: ["mens-shoes", "womens-shoes"] })))).toEqual(["A", "B", "C", "D"]);
  });

  it("filters by brand and excludes products without a brand", () => {
    expect(titles(applyFilters(catalogue, state({ brands: ["Nike"] })))).toEqual(["A", "C"]);
  });

  it("filters by an inclusive price range on the discounted price", () => {
    expect(titles(applyFilters(catalogue, state({ minPrice: 2500, maxPrice: 4500 })))).toEqual(["A", "B", "D"]);
    expect(titles(applyFilters(catalogue, state({ maxPrice: 1500 })))).toEqual(["C"]);
  });

  it("filters by minimum rating", () => {
    expect(titles(applyFilters(catalogue, state({ minRating: 4.5 })))).toEqual(["A", "C", "E"]);
  });

  it("filters by availability", () => {
    expect(titles(applyFilters(catalogue, state({ availability: "out" })))).toEqual(["E"]);
    expect(applyFilters(catalogue, state({ availability: "in" }))).toHaveLength(5);
  });

  it("filters to on-sale products", () => {
    expect(titles(applyFilters(catalogue, state({ onSale: true })))).toEqual(["F"]);
  });

  it("combines all active filters (PRD MOD-02-001)", () => {
    const result = applyFilters(
      catalogue,
      state({ categories: ["mens-shoes", "womens-shoes"], minPrice: 2000, maxPrice: 5000, minRating: 4 }),
    );
    expect(titles(sortProducts(result, "price-asc"))).toEqual(["A", "B"]);
  });
});

describe("isOnSale", () => {
  it("uses the documented 10 percent threshold", () => {
    expect(isOnSale(makeProduct({ discountPercentage: 9.9 }))).toBe(false);
    expect(isOnSale(makeProduct({ discountPercentage: 10 }))).toBe(true);
  });
});

describe("sortProducts", () => {
  it("keeps source order for relevance and does not mutate the input", () => {
    const before = titles(catalogue);
    expect(titles(sortProducts(catalogue, "relevance"))).toEqual(before);
    sortProducts(catalogue, "price-asc");
    expect(titles(catalogue)).toEqual(before);
  });

  it("sorts by price in both directions", () => {
    expect(titles(sortProducts(catalogue, "price-asc"))).toEqual(["C", "D", "A", "B", "F", "E"]);
    expect(titles(sortProducts(catalogue, "price-desc"))).toEqual(["E", "F", "B", "A", "D", "C"]);
  });

  it("sorts by rating, highest first", () => {
    expect(titles(sortProducts(catalogue, "rating"))).toEqual(["E", "C", "A", "B", "F", "D"]);
  });

  it("sorts newest first, with unknown dates last", () => {
    const products = [
      makeProduct({ title: "old", createdAt: 1000 }),
      makeProduct({ title: "unknown", createdAt: null }),
      makeProduct({ title: "new", createdAt: 3000 }),
    ];
    expect(titles(sortProducts(products, "newest"))).toEqual(["new", "old", "unknown"]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 50 }, (_, index) => index + 1);

  it("slices a page and reports totals", () => {
    const page = paginate(items, 2, 24);
    expect(page.items).toHaveLength(24);
    expect(page.items[0]).toBe(25);
    expect(page).toMatchObject({ page: 2, totalPages: 3, total: 50 });
  });

  it("clamps out-of-range and invalid pages", () => {
    expect(paginate(items, 99, 24).page).toBe(3);
    expect(paginate(items, 0, 24).page).toBe(1);
    expect(paginate(items, Number.NaN, 24).page).toBe(1);
  });

  it("handles an empty list", () => {
    expect(paginate([], 1, 24)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
  });
});

describe("getPageItems", () => {
  it("shows every page when there are few", () => {
    expect(getPageItems(1, 3)).toEqual([1, 2, 3]);
  });

  it("collapses distant pages into ellipses", () => {
    expect(getPageItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(getPageItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(getPageItems(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});

describe("getPriceBounds and getBrandOptions", () => {
  it("rounds bounds outward to the step", () => {
    expect(getPriceBounds(catalogue)).toEqual({ min: 1500, max: 60000 });
    expect(getPriceBounds([makeProduct({ finalPrice: 1234 })])).toEqual({ min: 1200, max: 1300 });
  });

  it("returns zero bounds for no products", () => {
    expect(getPriceBounds([])).toEqual({ min: 0, max: 0 });
  });

  it("lists unique brands alphabetically, skipping missing ones", () => {
    expect(getBrandOptions(catalogue)).toEqual(["Apple", "Nike", "Puma"]);
  });
});

describe("active filters", () => {
  const name = (slug: string) => `Name of ${slug}`;
  const full = state({
    categories: ["mens-shoes"],
    brands: ["Nike"],
    minPrice: 2000,
    maxPrice: 5000,
    minRating: 4,
    availability: "in",
    onSale: true,
    page: 3,
  });

  it("describes each active filter in plain language", () => {
    expect(getActiveFilters(full, name).map((filter) => filter.label)).toEqual([
      "Name of mens-shoes",
      "Nike",
      "₹2,000 to ₹5,000",
      "4 stars and up",
      "In stock",
      "On sale (10% off or more)",
    ]);
  });

  it("labels one-sided price ranges", () => {
    expect(getActiveFilters(state({ minPrice: 2000 }), name)[0]?.label).toBe("From ₹2,000");
    expect(getActiveFilters(state({ maxPrice: 5000 }), name)[0]?.label).toBe("Up to ₹5,000");
  });

  it("does not list a locked category page's own category", () => {
    expect(getActiveFilters(state({ categories: ["mens-shoes"] }), name, "mens-shoes")).toEqual([]);
  });

  it("removes a single filter and resets to page 1", () => {
    const next = removeFilter(full, { type: "brand", value: "Nike" });
    expect(next.brands).toEqual([]);
    expect(next.minRating).toBe(4);
    expect(next.page).toBe(1);

    const noPrice = removeFilter(full, { type: "price" });
    expect(noPrice.minPrice).toBeUndefined();
    expect(noPrice.maxPrice).toBeUndefined();
  });

  it("clears all filters but keeps the query, sort and locked category", () => {
    const cleared = clearAllFilters({ ...full, query: "shoes", sort: "rating" }, "mens-shoes");
    expect(cleared).toEqual({ ...DEFAULT_DISCOVERY_STATE, query: "shoes", sort: "rating", categories: ["mens-shoes"] });
  });
});
