import { INR_PER_USD } from "@/lib/currency";
import { ApiError } from "./client";
import { mapProduct, parseCatalogueReviews, parseCategories, parseProductList, parseSuggestions } from "./mappers";

const raw = {
  id: 7,
  title: "Running Shoe",
  description: "Light and fast.",
  category: "mens-shoes",
  price: 100,
  discountPercentage: 20,
  rating: 4.4,
  stock: 30,
  tags: ["running", "shoes"],
  brand: "Nike",
  thumbnail: "https://cdn.dummyjson.com/x/thumbnail.png",
  availabilityStatus: "In Stock",
  meta: { createdAt: "2024-05-23T08:56:21.618Z" },
};

describe("mapProduct", () => {
  it("maps a DummyJSON product to the domain model in rupees", () => {
    const product = mapProduct(raw);
    expect(product).toMatchObject({
      id: 7,
      title: "Running Shoe",
      category: "mens-shoes",
      brand: "Nike",
      price: 100 * INR_PER_USD,
      discountPercentage: 20,
      finalPrice: 80 * INR_PER_USD,
      rating: 4.4,
      availability: "in-stock",
      thumbnail: "https://cdn.dummyjson.com/x/thumbnail.png",
    });
    expect(product?.createdAt).toBe(Date.parse("2024-05-23T08:56:21.618Z"));
  });

  it("rejects items that cannot be shown safely", () => {
    expect(mapProduct(null)).toBeNull();
    expect(mapProduct("string")).toBeNull();
    expect(mapProduct({ ...raw, id: "7" })).toBeNull();
    expect(mapProduct({ ...raw, title: "  " })).toBeNull();
    expect(mapProduct({ ...raw, price: "100" })).toBeNull();
    expect(mapProduct({ ...raw, price: -1 })).toBeNull();
  });

  it("fills sensible defaults for optional fields", () => {
    const product = mapProduct({ id: 1, title: "Bare", price: 10 });
    expect(product).toMatchObject({
      brand: null,
      category: "uncategorized",
      discountPercentage: 0,
      rating: 0,
      stock: 0,
      availability: "out-of-stock",
      thumbnail: null,
      createdAt: null,
      tags: [],
    });
  });

  it("clamps out-of-range numbers", () => {
    const product = mapProduct({ ...raw, rating: 9, discountPercentage: 150, stock: -4 });
    expect(product).toMatchObject({ rating: 5, discountPercentage: 100, finalPrice: 0, stock: 0 });
  });

  it("derives availability from stock and status", () => {
    expect(mapProduct({ ...raw, stock: 0 })?.availability).toBe("out-of-stock");
    expect(mapProduct({ ...raw, availabilityStatus: "Out of Stock" })?.availability).toBe("out-of-stock");
    expect(mapProduct({ ...raw, availabilityStatus: "Low Stock" })?.availability).toBe("low-stock");
    expect(mapProduct({ ...raw, availabilityStatus: "In Stock", stock: 3 })?.availability).toBe("low-stock");
  });

  it("falls back to the first image when there is no thumbnail", () => {
    const product = mapProduct({ ...raw, thumbnail: undefined, images: ["https://cdn.dummyjson.com/y.png"] });
    expect(product?.thumbnail).toBe("https://cdn.dummyjson.com/y.png");
  });
});

describe("parseProductList", () => {
  it("maps valid items and silently drops invalid ones", () => {
    const products = parseProductList({ products: [raw, { nonsense: true }, null] });
    expect(products).toHaveLength(1);
  });

  it("accepts an empty result", () => {
    expect(parseProductList({ products: [] })).toEqual([]);
  });

  it("throws a parse error for an unexpected shape (edge case 21)", () => {
    for (const bad of [null, [], { items: [] }, { products: "no" }, "text"]) {
      let kind: string | undefined;
      try {
        parseProductList(bad);
      } catch (error) {
        kind = error instanceof ApiError ? error.kind : "other";
      }
      expect(kind).toBe("parse");
    }
  });

  it("throws a parse error when nothing in a non-empty list is readable", () => {
    let kind: string | undefined;
    try {
      parseProductList({ products: [{ bad: 1 }, { worse: 2 }] });
    } catch (error) {
      kind = error instanceof ApiError ? error.kind : "other";
    }
    expect(kind).toBe("parse");
  });
});

describe("parseSuggestions", () => {
  it("keeps only readable suggestions", () => {
    const suggestions = parseSuggestions({
      products: [
        { id: 1, title: "Phone", category: "smartphones", thumbnail: "https://x/y.png" },
        { id: "bad" },
        { id: 2, title: "Case" },
      ],
    });
    expect(suggestions).toEqual([
      { id: 1, title: "Phone", category: "smartphones", thumbnail: "https://x/y.png" },
      { id: 2, title: "Case", category: "uncategorized", thumbnail: null },
    ]);
  });
});

describe("parseCategories", () => {
  it("reads category objects", () => {
    expect(parseCategories([{ slug: "mens-shoes", name: "Mens Shoes", url: "u" }])).toEqual([
      { slug: "mens-shoes", name: "Mens Shoes" },
    ]);
  });

  it("reads plain string categories and derives names", () => {
    expect(parseCategories(["home-decoration", "laptops"])).toEqual([
      { slug: "home-decoration", name: "Home Decoration" },
      { slug: "laptops", name: "Laptops" },
    ]);
  });

  it("skips malformed entries and rejects a non-array response", () => {
    expect(parseCategories([null, 5, { name: "No slug" }, "ok"])).toEqual([{ slug: "ok", name: "Ok" }]);
    let kind: string | undefined;
    try {
      parseCategories({ categories: [] });
    } catch (error) {
      kind = error instanceof ApiError ? error.kind : "other";
    }
    expect(kind).toBe("parse");
  });
});


describe("parseCatalogueReviews (PRD 5.10, edge case 21)", () => {
  it("maps the API's reviews to whole-star reviews with a timestamp", () => {
    expect(parseCatalogueReviews([{ rating: 4.4, comment: "Good", date: "2025-05-23T08:56:21.618Z", reviewerName: "Asha", reviewerEmail: "a@x.com" }])).toEqual([
      { rating: 4, comment: "Good", date: Date.parse("2025-05-23T08:56:21.618Z"), reviewerName: "Asha" },
    ]);
  });

  it("drops entries without a usable rating and defaults the other fields", () => {
    const reviews = parseCatalogueReviews([{ rating: 0 }, { rating: 6 }, { rating: "5" }, null, "x", { rating: 3, date: "garbage" }]);
    expect(reviews).toEqual([{ rating: 3, comment: "", date: null, reviewerName: "Anonymous" }]);
  });

  it("clips an oversized comment and is empty when the field is not a list", () => {
    expect(parseCatalogueReviews([{ rating: 5, comment: "x".repeat(5000) }])[0]?.comment).toHaveLength(1000);
    expect(parseCatalogueReviews(undefined)).toEqual([]);
    expect(parseCatalogueReviews({})).toEqual([]);
  });
});
