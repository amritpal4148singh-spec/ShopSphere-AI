import { getVariantGroup } from "./variants";

const stocks = (id: number, category: string, stock: number) =>
  getVariantGroup({ id, category, stock })?.options.map((option) => option.stock) ?? [];

describe("getVariantGroup", () => {
  it("returns null for categories without variants", () => {
    expect(getVariantGroup({ id: 1, category: "groceries", stock: 10 })).toBeNull();
    expect(getVariantGroup({ id: 1, category: "uncategorized", stock: 10 })).toBeNull();
  });

  it("offers sizes for footwear and apparel, colours for accessories, storage for devices", () => {
    expect(getVariantGroup({ id: 1, category: "mens-shoes", stock: 10 })?.options.map((o) => o.label)).toEqual(["6", "7", "8", "9", "10"]);
    expect(getVariantGroup({ id: 1, category: "tops", stock: 10 })?.options.map((o) => o.label)).toEqual(["S", "M", "L", "XL"]);
    expect(getVariantGroup({ id: 1, category: "sunglasses", stock: 10 })).toMatchObject({ label: "Colour" });
    expect(getVariantGroup({ id: 1, category: "smartphones", stock: 10 })).toMatchObject({ label: "Storage" });
    expect(getVariantGroup({ id: 1, category: "fragrances", stock: 10 })?.options.map((o) => o.label)).toEqual(["30 ml", "50 ml", "100 ml"]);
  });

  it("gives stable, unique option ids", () => {
    const group = getVariantGroup({ id: 1, category: "smartphones", stock: 10 });
    expect(group?.options.map((option) => option.id)).toEqual(["storage-128gb", "storage-256gb", "storage-512gb"]);
  });

  it("always splits stock so that the options add up to the product's stock", () => {
    for (const category of ["mens-shoes", "tops", "sunglasses", "smartphones", "beauty"]) {
      for (let id = 1; id <= 120; id++) {
        for (const stock of [0, 1, 2, 5, 7, 25, 100]) {
          expect(stocks(id, category, stock).reduce((sum, units) => sum + units, 0)).toBe(stock);
        }
      }
    }
  });

  it("makes every option out of stock when the product is out of stock", () => {
    expect(stocks(7, "mens-shoes", 0).every((units) => units === 0)).toBe(true);
  });

  it("keeps at least one option in stock whenever the product has stock", () => {
    for (let id = 1; id <= 120; id++) {
      expect(stocks(id, "mens-shoes", 3).some((units) => units > 0)).toBe(true);
    }
  });

  it("sells out exactly one option on every third product (so MOD-04-001 is visible)", () => {
    for (const id of [3, 6, 9, 12, 30]) {
      const split = stocks(id, "mens-shoes", 100);
      expect(split.filter((units) => units === 0)).toHaveLength(1);
    }
  });

  it("leaves every option stocked on other products with plenty of stock", () => {
    for (const id of [1, 2, 4, 5, 7, 8]) {
      expect(stocks(id, "mens-shoes", 100).every((units) => units > 0)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(getVariantGroup({ id: 42, category: "tops", stock: 33 })).toEqual(getVariantGroup({ id: 42, category: "tops", stock: 33 }));
  });
});
