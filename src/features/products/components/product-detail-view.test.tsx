import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchCategories, fetchProduct } from "@/services/products";
import { makeProductDetail } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { useReviewsStore } from "@/store/reviews-store";
import { useViewedStore } from "@/store/viewed-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { ProductDetailView } from "./product-detail-view";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);
vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchProduct: vi.fn(), fetchCategories: vi.fn() };
});

const product = makeProductDetail({
  id: 42,
  title: "Trail Runner",
  brand: "Nike",
  category: "mens-shoes",
  price: 4000,
  discountPercentage: 25,
  finalPrice: 3000,
  rating: 4.46,
  stock: 100,
  description: "Light and fast.",
  sku: "RUN-042",
  tags: ["running", "shoes"],
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useWishlistStore.setState({ status: "idle", ownerId: null, items: [] });
  useWishlistStore.getState().switchOwner(null);
  useViewedStore.setState({ status: "idle", items: [] });
  vi.mocked(fetchProduct).mockReset().mockResolvedValue(product);
  vi.mocked(fetchCategories).mockReset().mockResolvedValue([{ slug: "mens-shoes", name: "Mens Shoes" }]);
});

describe("ProductDetailView", () => {
  it("shows a skeleton, then the full product page", async () => {
    renderWithClient(<ProductDetailView productId="42" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading product");

    expect(await screen.findByRole("heading", { level: 1, name: "Trail Runner" })).toBeInTheDocument();
    expect(fetchProduct).toHaveBeenCalledWith(42, expect.anything());
    expect(screen.getByText("₹3,000")).toBeInTheDocument();
    expect(screen.getByText("Nike ·", { exact: false })).toBeInTheDocument();
    // The rating line is the average of the listed reviews (5, 5 and 4), not the catalogue's 4.46 (PRD 5.4, 5.10).
    expect(screen.getByLabelText("Rated 4.7 out of 5")).toBeInTheDocument();
    expect(screen.getByText("(3 reviews)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Delivery" })).toBeInTheDocument();
  });

  it("shows the original price struck through with the discount", async () => {
    renderWithClient(<ProductDetailView productId="42" />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("₹4,000")).toHaveClass("line-through");
    expect(screen.getByText("25% off")).toBeInTheDocument();
  });

  it("does not show a strike-through price when there is no discount", async () => {
    vi.mocked(fetchProduct).mockResolvedValue(makeProductDetail({ id: 42, price: 1000, discountPercentage: 0, finalPrice: 1000 }));
    renderWithClient(<ProductDetailView productId="42" />);

    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it("links the breadcrumb to the shop and the product's category", async () => {
    renderWithClient(<ProductDetailView productId="42" />);

    const nav = await screen.findByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveTextContent("Trail Runner");
    expect(screen.getAllByRole("link", { name: "Shop" })[0]).toHaveAttribute("href", "/products");
    expect(screen.getAllByRole("link", { name: "Mens Shoes" })[0]).toHaveAttribute("href", "/category/mens-shoes");
  });

  it("puts the product title in the document title", async () => {
    renderWithClient(<ProductDetailView productId="42" />);

    await screen.findByRole("heading", { level: 1 });
    expect(document.title).toBe("Trail Runner | ShopSphere AI");
  });

  it("offers description and specification tabs", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductDetailView productId="42" />);

    expect(await screen.findByText("Light and fast.")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Specifications" }));

    expect(screen.getByText("RUN-042")).toBeInTheDocument();
    expect(screen.getByText("running, shoes")).toBeInTheDocument();
    expect(screen.getByText("Mens Shoes", { selector: "dd" })).toBeInTheDocument();
  });

  it("lets the shopper save the product to the wishlist from the detail page", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductDetailView productId="42" />);

    const heart = await screen.findByRole("button", { name: "Add Trail Runner to wishlist" });
    expect(heart).toHaveAttribute("aria-pressed", "false");

    await user.click(heart);

    expect(screen.getByRole("button", { name: "Remove Trail Runner from wishlist" })).toHaveAttribute("aria-pressed", "true");
    expect(useWishlistStore.getState().items[0]).toMatchObject({ productId: 42, title: "Trail Runner", price: 3000 });
  });

  it("shows the recommendations the route supplies, after the product information", async () => {
    renderWithClient(<ProductDetailView productId="42" recommendations={<p>RAILS FROM THE ROUTE</p>} />);

    expect(await screen.findByText("RAILS FROM THE ROUTE")).toBeInTheDocument();
  });

  it("works without any recommendations", async () => {
    renderWithClient(<ProductDetailView productId="42" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Trail Runner" })).toBeInTheDocument();
  });

  it("records the view, once the product has loaded, as a recommendation signal (PRD 6.1)", async () => {
    renderWithClient(<ProductDetailView productId="42" />);
    expect(useViewedStore.getState().items).toEqual([]);

    await screen.findByRole("heading", { level: 1, name: "Trail Runner" });

    await waitFor(() => expect(useViewedStore.getState().items).toHaveLength(1));
    expect(useViewedStore.getState().items[0]).toMatchObject({ productId: 42, category: "mens-shoes", brand: "Nike", price: 3000, tags: ["running", "shoes"] });
  });

  it("does not record a view for a product that does not exist", async () => {
    vi.mocked(fetchProduct).mockRejectedValue(new ApiError("http", "not found", 404));
    renderWithClient(<ProductDetailView productId="999" />);

    await screen.findByRole("heading", { name: "This product is no longer available" });
    expect(useViewedStore.getState().items).toEqual([]);
  });

  it("shows a clear 'no longer available' page for a removed product, without retrying (edge case 2)", async () => {
    vi.mocked(fetchProduct).mockRejectedValue(new ApiError("http", "not found", 404));
    renderWithClient(<ProductDetailView productId="999" />);

    expect(await screen.findByRole("heading", { name: "This product is no longer available" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse all products" })).toHaveAttribute("href", "/products");
    expect(fetchProduct).toHaveBeenCalledTimes(1);
  });

  it.each(["abc", "0", "-5", "4.5", "1e3", ""])("treats the invalid id %j as unavailable without calling the API", async (id) => {
    renderWithClient(<ProductDetailView productId={id} />);

    expect(await screen.findByRole("heading", { name: "This product is no longer available" })).toBeInTheDocument();
    expect(fetchProduct).not.toHaveBeenCalled();
  });

  it("shows a distinguishable offline error with a retry that recovers (edge case 3)", async () => {
    const user = userEvent.setup();
    // The hook retries a failed request once (after about a second) before giving up.
    vi.mocked(fetchProduct).mockRejectedValue(new ApiError("network", "down"));
    renderWithClient(<ProductDetailView productId="42" />);

    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent("You appear to be offline");

    vi.mocked(fetchProduct).mockResolvedValue(product);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Trail Runner" })).toBeInTheDocument();
  });

  it("keeps showing the product with a retry banner when a refresh fails (edge case 3)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    render(
      <QueryClientProvider client={client}>
        <ProductDetailView productId="42" />
      </QueryClientProvider>,
    );
    await screen.findByRole("heading", { level: 1, name: "Trail Runner" });

    vi.mocked(fetchProduct).mockRejectedValue(new ApiError("network", "down"));
    await act(async () => {
      await client.refetchQueries({ queryKey: ["product", 42] });
    });

    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent("Showing the products loaded earlier");
    expect(screen.getByRole("heading", { level: 1, name: "Trail Runner" })).toBeInTheDocument();
  });
});

describe("ProductDetailView reviews (PRD 5.4, 5.10)", () => {
  beforeEach(() => {
    useReviewsStore.setState({ status: "idle", reviews: [], votes: {}, hidden: {}, saveFailed: false });
    useReviewsStore.getState().hydrate();
  });

  it("shows the review section, and the rating line links to it", async () => {
    renderWithClient(<ProductDetailView productId="42" />);
    await screen.findByRole("heading", { level: 1, name: "Trail Runner" });

    expect(screen.getByRole("heading", { level: 2, name: "Customer reviews" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "(3 reviews)" })).toHaveAttribute("href", "#reviews");
    expect(screen.getByText("Based on 3 reviews")).toBeInTheDocument();
  });

  it("updates the average and count when a review is hidden by a moderator", async () => {
    renderWithClient(<ProductDetailView productId="42" />);
    await screen.findByRole("heading", { level: 1, name: "Trail Runner" });
    expect(screen.getByLabelText("Rated 4.7 out of 5")).toBeInTheDocument();

    act(() => useReviewsStore.getState().hide({ reviewId: "catalogue-42-2", productId: 42, source: "catalogue", authorName: "Meera", rating: 4, body: "Good value for money." }));
    expect(screen.getByLabelText("Rated 5.0 out of 5")).toBeInTheDocument();
    expect(screen.getByText("(2 reviews)")).toBeInTheDocument();
  });

  it("falls back to the catalogue rating with a plain note when a product has no reviews", async () => {
    vi.mocked(fetchProduct).mockResolvedValue({ ...product, reviews: [] });
    renderWithClient(<ProductDetailView productId="42" />);
    await screen.findByRole("heading", { level: 1, name: "Trail Runner" });
    expect(screen.getByLabelText("Rated 4.5 out of 5")).toBeInTheDocument();
    expect(screen.getByText("(no reviews yet)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No reviews yet" })).toBeInTheDocument();
  });
});
