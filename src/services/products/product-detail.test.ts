import { ApiError } from "./client";
import { mapProductDetail, parseProductDetail } from "./mappers";
import { fetchProduct } from "./product-service";

const raw = {
  id: 7,
  title: "Running Shoe",
  price: 100,
  discountPercentage: 10,
  rating: 4.4,
  stock: 12,
  category: "mens-shoes",
  brand: "Nike",
  thumbnail: "https://cdn.dummyjson.com/x/thumbnail.png",
  images: ["https://cdn.dummyjson.com/x/1.png", "https://cdn.dummyjson.com/x/2.png", "https://cdn.dummyjson.com/x/1.png", "", 5],
  reviews: [{ rating: 5 }, { rating: 4 }, { rating: 3 }],
  sku: "RUN-007",
  warrantyInformation: "1 year warranty",
  shippingInformation: "Ships in 1-2 business days",
  returnPolicy: "30 days return policy",
  minimumOrderQuantity: 2,
};

describe("mapProductDetail", () => {
  it("adds gallery images, reviews and shipping details to the product", () => {
    const detail = mapProductDetail(raw);
    expect(detail).toMatchObject({
      id: 7,
      title: "Running Shoe",
      sku: "RUN-007",
      warrantyInformation: "1 year warranty",
      shippingInformation: "Ships in 1-2 business days",
      returnPolicy: "30 days return policy",
      minimumOrderQuantity: 2,
    });
    expect(detail?.reviews.map((review) => review.rating)).toEqual([5, 4, 3]);
  });

  it("de-duplicates images, drops unusable ones, and appends the thumbnail last", () => {
    expect(mapProductDetail(raw)?.images).toEqual([
      "https://cdn.dummyjson.com/x/1.png",
      "https://cdn.dummyjson.com/x/2.png",
      "https://cdn.dummyjson.com/x/thumbnail.png",
    ]);
  });

  it("does not repeat the thumbnail when it is already in the gallery", () => {
    const detail = mapProductDetail({ ...raw, images: ["https://cdn.dummyjson.com/x/thumbnail.png"] });
    expect(detail?.images).toEqual(["https://cdn.dummyjson.com/x/thumbnail.png"]);
  });

  it("fills defaults when optional detail fields are missing", () => {
    const detail = mapProductDetail({ id: 1, title: "Bare", price: 10 });
    expect(detail).toMatchObject({
      images: [],
      reviews: [],
      sku: null,
      warrantyInformation: null,
      shippingInformation: null,
      returnPolicy: null,
      minimumOrderQuantity: 1,
    });
  });

  it("returns null when the core product is unreadable", () => {
    expect(mapProductDetail(null)).toBeNull();
    expect(mapProductDetail({ id: "x" })).toBeNull();
  });
});

describe("parseProductDetail", () => {
  it("throws a parse error for an unreadable response (PRD edge case 21)", () => {
    let kind: string | undefined;
    try {
      parseProductDetail({ message: "oops" });
    } catch (error) {
      kind = error instanceof ApiError ? error.kind : "other";
    }
    expect(kind).toBe("parse");
  });
});

describe("fetchProduct", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("requests the product by id", async () => {
    let requested = "";
    globalThis.fetch = (async (url: string) => {
      requested = String(url);
      return new Response(JSON.stringify(raw), { status: 200 });
    }) as typeof fetch;

    const detail = await fetchProduct(7);
    expect(detail.id).toBe(7);
    expect(requested.endsWith("/products/7")).toBe(true);
  });

  it("surfaces a removed product as an HTTP 404 (PRD edge case 2)", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: "Product with id '9' not found" }), { status: 404 })) as typeof fetch;

    let error: unknown;
    try {
      await fetchProduct(9);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("http");
    expect((error as ApiError).status).toBe(404);
  });
});
