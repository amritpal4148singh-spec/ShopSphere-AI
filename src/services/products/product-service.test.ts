import { fetchCatalog, fetchCategories, fetchSuggestions, searchProducts } from "./product-service";

const realFetch = globalThis.fetch;
let requested: string[] = [];

function stubJson(body: unknown) {
  requested = [];
  globalThis.fetch = (async (url: string) => {
    requested.push(String(url));
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const oneProduct = { products: [{ id: 1, title: "Phone", price: 10, category: "smartphones" }] };

describe("product service", () => {
  it("loads the whole catalogue with only the fields discovery needs", async () => {
    stubJson(oneProduct);
    const products = await fetchCatalog();

    expect(products).toHaveLength(1);
    const url = requested[0] ?? "";
    expect(url).toContain("/products?limit=0&select=");
    expect(url).toContain("discountPercentage");
  });

  it("searches through the API with an encoded query", async () => {
    stubJson(oneProduct);
    await searchProducts("red shoes & socks");

    const url = requested[0] ?? "";
    expect(url).toContain("/products/search?q=red%20shoes%20%26%20socks");
    expect(url).toContain("limit=0");
  });

  it("requests a small page of suggestions", async () => {
    stubJson(oneProduct);
    await fetchSuggestions("ph");

    const url = requested[0] ?? "";
    expect(url).toContain("/products/search?q=ph");
    expect(url).toContain("limit=5");
  });

  it("loads categories", async () => {
    stubJson([{ slug: "laptops", name: "Laptops" }]);
    expect(await fetchCategories()).toEqual([{ slug: "laptops", name: "Laptops" }]);
    expect(requested[0]).toContain("/products/categories");
  });
});
