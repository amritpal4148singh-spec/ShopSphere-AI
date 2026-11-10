import { makeProduct } from "@/test/fixtures";
import type { AdminProduct, CatalogueOverlay, ProductDraft } from "@/types/admin";
import {
  EMPTY_OVERLAY,
  LOCAL_ID_START,
  addCategory,
  applyOverlay,
  availabilityFor,
  buildCategoryRows,
  createLocalProduct,
  filterAdminProducts,
  productToDraft,
  referencedProductIds,
  removeProduct,
  renameCategory,
  restoreProduct,
  revertProduct,
  saveProductValues,
  slugify,
  sortAdminProducts,
  validateDraft,
  valuesOf,
  DEFAULT_FILTERS,
} from "./admin-catalogue";

const base = [
  makeProduct({ id: 1, title: "Alpha Phone", category: "smartphones", brand: "Acme", price: 10000, discountPercentage: 10, finalPrice: 9000, stock: 50, rating: 4.5, tags: ["phone"] }),
  makeProduct({ id: 2, title: "Bravo Laptop", category: "laptops", brand: "Zenith", price: 50000, stock: 3, availability: "low-stock", rating: 4.1 }),
  makeProduct({ id: 3, title: "Charlie Case", category: "mobile-accessories", brand: null, price: 500, stock: 0, availability: "out-of-stock", rating: 3.2 }),
];
const categorySlugs = ["smartphones", "laptops", "mobile-accessories"];
const draft: ProductDraft = { title: "  New   Gadget ", brand: " Acme ", category: "laptops", price: "1200", discountPercentage: "", stock: "7", description: "Nice.", tags: "Tech, GADGET, tech" };

describe("applyOverlay (PRD 8.2: simulated, scoped to local state)", () => {
  it("shows the API products unchanged when nothing was edited", () => {
    const products = applyOverlay(base, EMPTY_OVERLAY);
    expect(products).toHaveLength(3);
    expect(products.every((product) => product.status === "active" && product.origin === "catalogue" && !product.edited)).toBe(true);
    expect(products[1]?.availability).toBe("low-stock");
  });

  it("applies local edits, recomputing the discounted price and availability", () => {
    const overlay = saveProductValues(EMPTY_OVERLAY, { id: 1, origin: "catalogue" }, { ...valuesOf(base[0]!), price: 20000, discountPercentage: 25, stock: 2 });
    const edited = applyOverlay(base, overlay)[0]!;
    expect(edited).toMatchObject({ price: 20000, finalPrice: 15000, stock: 2, availability: "low-stock", edited: true, rating: 4.5 });
  });

  it("includes locally created products with ids above the API range, marked as local", () => {
    const { overlay, id } = createLocalProduct(EMPTY_OVERLAY, { title: "Local", brand: null, category: "laptops", price: 100, discountPercentage: 0, stock: 4, description: "", tags: [] }, 99);
    expect(id).toBe(LOCAL_ID_START);
    expect(overlay.nextLocalId).toBe(LOCAL_ID_START + 1);
    const local = applyOverlay(base, overlay).find((product) => product.id === id)!;
    expect(local).toMatchObject({ origin: "local", status: "active", availability: "low-stock", thumbnail: null, createdAt: 99 });
  });

  it("marks removed and archived products by status", () => {
    const overlay: CatalogueOverlay = { ...EMPTY_OVERLAY, removed: [2], archived: [3] };
    expect(applyOverlay(base, overlay).map((product) => product.status)).toEqual(["active", "removed", "archived"]);
  });

  it("judges stock by the threshold", () => {
    expect([0, 1, 5, 6].map(availabilityFor)).toEqual(["out-of-stock", "low-stock", "low-stock", "in-stock"]);
  });
});

describe("removeProduct (PRD edge case 27)", () => {
  it("archives a product that existing orders reference instead of deleting it", () => {
    const result = removeProduct(EMPTY_OVERLAY, { id: 1, origin: "catalogue" }, new Set([1]));
    expect(result.outcome).toBe("archived");
    expect(result.overlay.archived).toEqual([1]);
    expect(result.overlay.removed).toEqual([]);
  });

  it("archives a locally created product that orders reference too, and never drops it", () => {
    const { overlay, id } = createLocalProduct(EMPTY_OVERLAY, { title: "Local", brand: null, category: "laptops", price: 100, discountPercentage: 0, stock: 4, description: "", tags: [] }, 1);
    const result = removeProduct(overlay, { id, origin: "local" }, new Set([id]));
    expect(result.outcome).toBe("archived");
    expect(result.overlay.added).toHaveLength(1);
  });

  it("removes an unreferenced catalogue product locally, and a local one completely", () => {
    expect(removeProduct(EMPTY_OVERLAY, { id: 2, origin: "catalogue" }, new Set()).overlay.removed).toEqual([2]);
    const { overlay, id } = createLocalProduct(EMPTY_OVERLAY, { title: "Local", brand: null, category: "laptops", price: 100, discountPercentage: 0, stock: 4, description: "", tags: [] }, 1);
    expect(removeProduct(overlay, { id, origin: "local" }, new Set()).overlay.added).toEqual([]);
  });

  it("restores archived and removed products", () => {
    const overlay = { ...EMPTY_OVERLAY, removed: [2], archived: [3, 1] };
    expect(restoreProduct(restoreProduct(overlay, 2), 3)).toMatchObject({ removed: [], archived: [1] });
  });

  it("finds the products orders reference", () => {
    expect(referencedProductIds([{ items: [{ productId: 1 }, { productId: 4 }] }, { items: [{ productId: 4 }] }] as never)).toEqual(new Set([1, 4]));
  });
});

describe("edits", () => {
  it("discards local edits of a catalogue product", () => {
    const overlay = saveProductValues(EMPTY_OVERLAY, { id: 1, origin: "catalogue" }, valuesOf(base[0]!));
    expect(revertProduct(overlay, 1).edits).toEqual({});
  });

  it("updates a locally created product in place", () => {
    const { overlay, id } = createLocalProduct(EMPTY_OVERLAY, { title: "Local", brand: null, category: "laptops", price: 100, discountPercentage: 0, stock: 4, description: "", tags: [] }, 1);
    const next = saveProductValues(overlay, { id, origin: "local" }, { ...overlay.added[0]!, title: "Renamed" });
    expect(next.added[0]?.title).toBe("Renamed");
    expect(next.edits).toEqual({});
  });
});

describe("validateDraft (PRD 13: every admin edit form)", () => {
  it("normalizes a valid draft", () => {
    const result = validateDraft(draft, categorySlugs);
    expect(result).toEqual({ ok: true, values: { title: "New Gadget", brand: "Acme", category: "laptops", price: 1200, discountPercentage: 0, stock: 7, description: "Nice.", tags: ["tech", "gadget"] } });
  });

  it("reports an error for each invalid field", () => {
    const result = validateDraft({ title: "x", brand: "b".repeat(61), category: "nope", price: "0", discountPercentage: "101", stock: "-1", description: "d".repeat(2001), tags: "a,b,c,d,e,f,g,h,i,j,k" }, categorySlugs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["brand", "category", "description", "discountPercentage", "price", "stock", "tags", "title"]);
  });

  it.each([["12.5"], ["abc"], ["1e3"], [""], ["-5"]])("rejects the price %j", (price) => {
    const result = validateDraft({ ...draft, price }, categorySlugs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.price).toBeDefined();
  });

  it("rejects a tag that is too long and fractional stock", () => {
    const longTag = validateDraft({ ...draft, tags: "x".repeat(31) }, categorySlugs);
    expect(longTag.ok === false && longTag.errors.tags).toBeTruthy();
    const fractional = validateDraft({ ...draft, stock: "2.5" }, categorySlugs);
    expect(fractional.ok === false && fractional.errors.stock).toBeTruthy();
  });

  it("builds a draft from a product and back", () => {
    const text = productToDraft(base[0]!);
    expect(text).toMatchObject({ title: "Alpha Phone", price: "10000", discountPercentage: "10", stock: "50", tags: "phone" });
    const result = validateDraft(text, categorySlugs);
    expect(result.ok && result.values.price).toBe(10000);
    expect(productToDraft().discountPercentage).toBe("0");
  });
});

describe("categories (PRD 8.2: create, rename, assign)", () => {
  const rows = () => buildCategoryRows([{ slug: "smartphones", name: "Smartphones" }, { slug: "laptops", name: "Laptops" }], EMPTY_OVERLAY, applyOverlay(base, EMPTY_OVERLAY));

  it("counts products per category and shows a category the list no longer returns", () => {
    const list = rows();
    expect(list.find((row) => row.slug === "laptops")?.productCount).toBe(1);
    expect(list.find((row) => row.slug === "mobile-accessories")).toMatchObject({ name: "Mobile Accessories", productCount: 1 });
  });

  it("creates a category with a slug, and refuses duplicates and bad names", () => {
    const created = addCategory(EMPTY_OVERLAY, "  Smart  Home & Garden ", rows());
    expect(created.ok && created.overlay.addedCategories).toEqual([{ slug: "smart-home-and-garden", name: "Smart Home & Garden" }]);
    expect(addCategory(EMPTY_OVERLAY, "laptops", rows())).toEqual({ ok: false, error: "A category with this name already exists." });
    expect(addCategory(EMPTY_OVERLAY, "x", rows()).ok).toBe(false);
    expect(addCategory(EMPTY_OVERLAY, "!!!", rows()).ok).toBe(false);
  });

  it("renames a category's display name only, keeping its slug and assignments", () => {
    const renamed = renameCategory(EMPTY_OVERLAY, "laptops", "Notebooks", rows());
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      const row = buildCategoryRows([{ slug: "laptops", name: "Laptops" }], renamed.overlay, applyOverlay(base, renamed.overlay)).find((r) => r.slug === "laptops");
      expect(row).toMatchObject({ name: "Notebooks", renamed: true, productCount: 1 });
    }
    expect(renameCategory(EMPTY_OVERLAY, "laptops", "Smartphones", rows()).ok).toBe(false);
    expect(renameCategory(EMPTY_OVERLAY, "laptops", "Laptops", rows()).ok).toBe(true);
  });

  it("slugifies names", () => {
    expect(slugify(" Men's  Shoes! ")).toBe("men-s-shoes");
  });
});

describe("list: filter and sort", () => {
  const products: AdminProduct[] = applyOverlay(base, { ...EMPTY_OVERLAY, removed: [3] });

  it("hides removed products unless asked, and filters by status", () => {
    expect(filterAdminProducts(products, DEFAULT_FILTERS).map((p) => p.id)).toEqual([1, 2]);
    expect(filterAdminProducts(products, { ...DEFAULT_FILTERS, status: "removed" }).map((p) => p.id)).toEqual([3]);
    expect(filterAdminProducts(products, { ...DEFAULT_FILTERS, status: "low-stock" }).map((p) => p.id)).toEqual([2]);
    expect(filterAdminProducts(applyOverlay(base, EMPTY_OVERLAY), { ...DEFAULT_FILTERS, status: "out-of-stock" }).map((p) => p.id)).toEqual([3]);
  });

  it("searches title, brand, tags and id, and filters by category", () => {
    expect(filterAdminProducts(products, { ...DEFAULT_FILTERS, query: "zenith" }).map((p) => p.id)).toEqual([2]);
    expect(filterAdminProducts(products, { ...DEFAULT_FILTERS, query: "PHONE" }).map((p) => p.id)).toEqual([1]);
    expect(filterAdminProducts(products, { ...DEFAULT_FILTERS, query: "2" }).map((p) => p.id)).toContain(2);
    expect(filterAdminProducts(products, { ...DEFAULT_FILTERS, category: "laptops" }).map((p) => p.id)).toEqual([2]);
    expect(filterAdminProducts(products, { ...DEFAULT_FILTERS, query: "nothing like this" })).toEqual([]);
  });

  it("sorts by title, price, stock and rating", () => {
    const ids = (sort: Parameters<typeof sortAdminProducts>[1]) => sortAdminProducts(products, sort).map((p) => p.id);
    expect(ids("title")).toEqual([1, 2, 3]);
    expect(ids("price-desc")).toEqual([2, 1, 3]);
    expect(ids("stock-asc")).toEqual([3, 2, 1]);
    expect(ids("rating")).toEqual([1, 2, 3]);
  });
});
