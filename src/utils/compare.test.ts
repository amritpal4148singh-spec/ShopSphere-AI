import { makeProduct } from "@/test/fixtures";
import { addCompareItem, buildComparisonRows, canCompare, COMPARE_MAX, isFull, NOT_SPECIFIED, removeCompareItem, toCompareItem, toggleCompareItem, type CompareItem } from "./compare";

const item = (n: number): CompareItem => ({ productId: n, title: `P${n}`, thumbnail: "t", category: "laptops" });

describe("comparison selection (PRD 5.2)", () => {
  it("adds products up to the maximum of four and refuses a fifth", () => {
    let items: CompareItem[] = [];
    for (let i = 1; i <= COMPARE_MAX; i += 1) items = addCompareItem(items, item(i)).items;
    expect(items).toHaveLength(4);
    expect(isFull(items)).toBe(true);
    expect(addCompareItem(items, item(5))).toEqual({ items, outcome: "full" });
  });

  it("never adds the same product twice", () => {
    const first = addCompareItem([], item(1)).items;
    expect(addCompareItem(first, item(1))).toEqual({ items: first, outcome: "duplicate" });
  });

  it("needs at least two products to compare", () => {
    expect(canCompare([])).toBe(false);
    expect(canCompare([item(1)])).toBe(false);
    expect(canCompare([item(1), item(2)])).toBe(true);
  });

  it("removes a product, and toggling adds then removes", () => {
    const two = [item(1), item(2)];
    expect(removeCompareItem(two, 1).items).toEqual([item(2)]);
    expect(toggleCompareItem(two, item(2)).outcome).toBe("removed");
    expect(toggleCompareItem(two, item(3)).outcome).toBe("added");
  });

  it("builds a selection from a product", () => {
    const product = makeProduct({ id: 9, title: "Lamp", category: "home" });
    expect(toCompareItem(product)).toEqual({ productId: 9, title: "Lamp", thumbnail: product.thumbnail, category: "home" });
  });
});

describe("buildComparisonRows", () => {
  const a = makeProduct({ id: 1, price: 1000, discountPercentage: 10, rating: 4.5, availability: "in-stock", brand: "Acme", tags: ["x"] });
  const b = makeProduct({ id: 2, price: 800, discountPercentage: 0, rating: 4.0, availability: "out-of-stock", brand: null, tags: [] });
  const row = (rows: ReturnType<typeof buildComparisonRows>, id: string) => rows.find((r) => r.id === id)!;

  it("highlights the lowest price, highest rating and highest discount", () => {
    const rows = buildComparisonRows([a, b], []);
    expect(row(rows, "price")).toMatchObject({ differs: true, best: [1] });
    expect(row(rows, "rating")).toMatchObject({ differs: true, best: [0] });
    expect(row(rows, "discount")).toMatchObject({ best: [0], values: ["10% off", "No discount"] });
    expect(row(rows, "availability").values).toEqual(["In stock", "Out of stock"]);
  });

  it("flags only rows that actually differ and picks no best when values are equal", () => {
    const rows = buildComparisonRows([a, makeProduct({ id: 3, price: 1000, discountPercentage: 10, rating: 4.5, brand: "Acme", category: a.category, description: a.description })], []);
    expect(row(rows, "price")).toMatchObject({ differs: false, best: [] });
    expect(row(rows, "brand").differs).toBe(false);
  });

  it("shows 'Not specified' for missing brand, tags and details instead of failing", () => {
    const rows = buildComparisonRows([a, b], [null, undefined]);
    expect(row(rows, "brand").values).toEqual(["Acme", NOT_SPECIFIED]);
    expect(row(rows, "tags").values).toEqual(["x", NOT_SPECIFIED]);
    expect(row(rows, "warranty").values).toEqual([NOT_SPECIFIED, NOT_SPECIFIED]);
  });

  it("uses loaded detail fields when present", () => {
    const detail = { ...a, images: [], reviews: [], sku: "SKU-1", warrantyInformation: "1 year", shippingInformation: "Ships in 2 days", returnPolicy: "30 days", minimumOrderQuantity: 1 };
    const rows = buildComparisonRows([a, b], [detail, null]);
    expect(row(rows, "warranty")).toMatchObject({ values: ["1 year", NOT_SPECIFIED], differs: true });
    expect(row(rows, "sku").values[0]).toBe("SKU-1");
  });

  it("treats unrated products without a best rating", () => {
    const rows = buildComparisonRows([makeProduct({ id: 4, rating: 0 }), makeProduct({ id: 5, rating: 4 })], []);
    expect(row(rows, "rating")).toMatchObject({ values: ["Not rated yet", "4.0 out of 5"], best: [] });
  });
});
