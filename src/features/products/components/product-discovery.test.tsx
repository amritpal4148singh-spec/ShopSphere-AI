
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchCatalog, fetchCategories, searchProducts } from "@/services/products";
import { makeProduct } from "@/test/fixtures";
import { push, replace, resetNavigation, setNavigation } from "@/test/navigation-mock";
import { renderWithClient } from "@/test/render";

import { ProductDiscovery } from "./product-discovery";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return {
    ...actual,
    fetchCatalog: vi.fn(),
    searchProducts: vi.fn(),
    fetchCategories: vi.fn(),
    fetchSuggestions: vi.fn(),
  };
});

const categories = [
  { slug: "mens-shoes", name: "Mens Shoes" },
  { slug: "womens-shoes", name: "Womens Shoes" },
  { slug: "smartphones", name: "Smartphones" },
];

const catalogue = [
  makeProduct({ id: 1, title: "Alpha Runner", category: "mens-shoes", brand: "Nike", finalPrice: 3000, price: 3000, rating: 4.5 }),
  makeProduct({ id: 2, title: "Bravo Boot", category: "mens-shoes", brand: "Puma", finalPrice: 4500, price: 4500, rating: 4.1 }),
  makeProduct({ id: 3, title: "Charlie Clog", category: "womens-shoes", brand: "Nike", finalPrice: 1500, price: 1500, rating: 4.8 }),
  makeProduct({ id: 4, title: "Delta Flat", category: "womens-shoes", brand: "Zara", finalPrice: 2500, price: 2500, rating: 3.2 }),
  makeProduct({ id: 5, title: "Echo Sandal", category: "womens-shoes", brand: "Zara", finalPrice: 4000, price: 4000, rating: 4.0 }),
  makeProduct({ id: 6, title: "Foxtrot Phone", category: "smartphones", brand: "Apple", finalPrice: 60000, price: 60000, rating: 4.9 }),
  makeProduct({ id: 7, title: "Golf Phone", category: "smartphones", brand: "Apple", finalPrice: 20000, price: 25000, rating: 4.0, discountPercentage: 20 }),
  makeProduct({ id: 8, title: "Hotel Phone", category: "smartphones", brand: "Apple", finalPrice: 9000, price: 9000, rating: 4.2, availability: "out-of-stock", stock: 0 }),
];

const cardTitles = () =>
  screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

beforeEach(() => {
  resetNavigation();
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue(catalogue);
  vi.mocked(searchProducts).mockReset().mockResolvedValue([]);
  vi.mocked(fetchCategories).mockReset().mockResolvedValue(categories);
});

describe("ProductDiscovery", () => {
  it("shows a loading skeleton, then the product grid with a result count", async () => {
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading products");

    expect(await screen.findByText("8 products")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "All products" })).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(8);
  });

  it("applies combined category, price, rating and sort filters with visible chips (PRD MOD-02-001)", async () => {
    setNavigation(
      "/products?category=mens-shoes&category=womens-shoes&minPrice=2000&maxPrice=5000&rating=4&sort=price-asc",
    );
    renderWithClient(<ProductDiscovery basePath="/products" />);

    expect(await screen.findByText("3 products")).toBeInTheDocument();
    expect(cardTitles()).toEqual(["Alpha Runner", "Echo Sandal", "Bravo Boot"]);

    const chips = within(screen.getByRole("list", { name: "Active filters" }));
    expect(chips.getByRole("button", { name: "Remove filter: Mens Shoes" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Remove filter: Womens Shoes" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Remove filter: ₹2,000 to ₹5,000" })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: "Remove filter: 4 stars and up" })).toBeInTheDocument();
  });

  it("explains an empty result by naming the filters and offers a one-click clear (PRD MOD-02-002)", async () => {
    const user = userEvent.setup();
    setNavigation("/products?rating=4&brand=Zara&category=smartphones");
    renderWithClient(<ProductDiscovery basePath="/products" />);

    expect(await screen.findByRole("heading", { name: "No products match your filters" })).toBeInTheDocument();
    const named = within(screen.getByRole("list", { name: "Filters with no results" }));
    expect(named.getByText("Zara")).toBeInTheDocument();
    expect(named.getByText("Smartphones")).toBeInTheDocument();
    expect(named.getByText("4 stars and up")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear Filters" }));

    expect(replace).toHaveBeenCalledWith("/products", { scroll: false });
    expect(await screen.findByText("8 products")).toBeInTheDocument();
  });

  it("re-sorts through the URL when the sort changes", async () => {
    const user = userEvent.setup();
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);
    await screen.findByText("8 products");

    await user.selectOptions(screen.getByLabelText("Sort by"), "price-desc");

    expect(replace).toHaveBeenLastCalledWith("/products?sort=price-desc", { scroll: false });
    await waitFor(() => expect(cardTitles()[0]).toBe("Foxtrot Phone"));
  });

  it("removes a single filter from its chip", async () => {
    const user = userEvent.setup();
    setNavigation("/products?rating=4&brand=Nike");
    renderWithClient(<ProductDiscovery basePath="/products" />);
    await screen.findByText("2 products");

    await user.click(screen.getByRole("button", { name: "Remove filter: Nike" }));

    expect(replace).toHaveBeenLastCalledWith("/products?rating=4", { scroll: false });
  });

  it("filters through the panel and resets to the first page", async () => {
    const user = userEvent.setup();
    setNavigation("/products?page=2");
    renderWithClient(<ProductDiscovery basePath="/products" />);
    await screen.findByText("8 products");

    await user.click(screen.getByRole("radio", { name: "In stock" }));

    expect(replace).toHaveBeenLastCalledWith("/products?availability=in", { scroll: false });
    expect(await screen.findByText("7 products")).toBeInTheDocument();
  });

  it("limits a category page to its category and hides the category filter", async () => {
    setNavigation("/category/mens-shoes");
    renderWithClient(<ProductDiscovery basePath="/category/mens-shoes" fixedCategory="mens-shoes" />);

    expect(await screen.findByText("2 products")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Mens Shoes" })).toBeInTheDocument();
    expect(cardTitles()).toEqual(["Alpha Runner", "Bravo Boot"]);
    expect(screen.queryByRole("group", { name: "Category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Active filters" })).not.toBeInTheDocument();
  });

  it("says so when a category has no products", async () => {
    setNavigation("/category/nothing-here");
    renderWithClient(<ProductDiscovery basePath="/category/nothing-here" fixedCategory="nothing-here" />);

    expect(await screen.findByRole("heading", { name: "This category has no products" })).toBeInTheDocument();
  });

  it("paginates large result sets and pushes the page into the URL", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog).mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => makeProduct({ id: 100 + index })),
    );
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);

    expect(await screen.findByText("30 products")).toBeInTheDocument();
    expect(cardTitles()).toHaveLength(24);

    await user.click(screen.getByRole("button", { name: "Page 2" }));

    expect(push).toHaveBeenLastCalledWith("/products?page=2", { scroll: false });
    await waitFor(() => expect(cardTitles()).toHaveLength(6));
  });

  it("searches through the API and shows spelling alternatives when nothing is found (edge case 6)", async () => {
    setNavigation("/search?q=phones");
    renderWithClient(<ProductDiscovery basePath="/search" />);

    expect(await screen.findByRole("heading", { name: "No results for “phones”" })).toBeInTheDocument();
    expect(searchProducts).toHaveBeenCalledWith("phones", expect.anything());
    expect(fetchCatalog).not.toHaveBeenCalled();

    const suggestion = await screen.findByRole("link", { name: "Smartphones" });
    expect(suggestion).toHaveAttribute("href", "/search?q=Smartphones");
  });

  it("shows search results with the query in the heading", async () => {
    vi.mocked(searchProducts).mockResolvedValue([catalogue[5]!]);
    setNavigation("/search?q=foxtrot");
    renderWithClient(<ProductDiscovery basePath="/search" />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Results for “foxtrot”",
      }),
    ).toBeInTheDocument();

    await screen.findByRole("heading", {
      level: 3,
      name: "Foxtrot Phone",
    });

    expect(cardTitles()).toEqual(["Foxtrot Phone"]);
  });

  it("shows a distinguishable offline error with a retry that recovers (PRD section 16)", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog)
      .mockRejectedValueOnce(new ApiError("network", "unreachable"))
      .mockResolvedValue(catalogue);
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("You appear to be offline");

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("8 products")).toBeInTheDocument();
  });

  it("describes a timeout differently from a network failure", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("timeout", "slow"));
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("taking too long");
  });

  it("recovers from a malformed response with a readable message (edge case 21)", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("parse", "bad shape"));
    setNavigation("/products");
    renderWithClient(<ProductDiscovery basePath="/products" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("unexpected data");
  });

  it("ignores an extremely long query without breaking the page (edge case 22)", async () => {
    setNavigation(`/search?q=${"x".repeat(400)}`);
    renderWithClient(<ProductDiscovery basePath="/search" />);

    await screen.findByRole("heading", { level: 1 });
    expect(vi.mocked(searchProducts).mock.calls[0]?.[0]).toHaveLength(100);
  });
});
