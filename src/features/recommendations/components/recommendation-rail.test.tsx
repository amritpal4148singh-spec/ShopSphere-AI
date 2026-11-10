import { act, screen, waitFor, within } from "@testing-library/react";

import { ApiError, fetchCatalog } from "@/services/products";
import { buildCatalog } from "@/test/catalog";
import { putInCart, putOnWishlist, resetRecommendationWorld, view } from "@/test/recommendations";
import { renderWithClient } from "@/test/render";
import { ProductPageRecommendations, RecommendationRail } from "./recommendation-rail";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const catalog = buildCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;
const cardTitles = () => screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

beforeEach(() => resetRecommendationWorld(catalog));

describe("RecommendationRail", () => {
  it("shows a heading that says what it is, what it is based on, and a card per product", async () => {
    renderWithClient(<RecommendationRail strategy="featured" />);

    expect(await screen.findByRole("heading", { level: 2, name: "Featured Products" })).toBeInTheDocument();
    expect(screen.getByText(/^Based on highly rated products/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Featured Products" })).toHaveAttribute("data-strategy", "featured");
    expect(cardTitles()).toHaveLength(8);
  });

  it("shows a loading skeleton for a rail that will always have content, and nothing for one that may not", () => {
    vi.mocked(fetchCatalog).mockReturnValue(new Promise(() => undefined));
    const { container, unmount } = renderWithClient(<RecommendationRail strategy="trending" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    unmount();

    const second = renderWithClient(<RecommendationRail strategy="recently-viewed" />);
    expect(second.container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(second.container.querySelector("section")).toBeNull();
  });

  it("hides a rail that has nothing to show, instead of rendering an empty box (PRD edge case 16)", async () => {
    renderWithClient(
      <>
        <RecommendationRail strategy="recently-viewed" />
        <RecommendationRail strategy="cart-based" />
        <RecommendationRail strategy="wishlist-based" />
        <RecommendationRail strategy="price-based" />
        <RecommendationRail strategy="featured" />
      </>,
    );

    await screen.findByRole("heading", { name: "Featured Products" });
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("hides every rail when the catalogue cannot be loaded, without an error box", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "down"));
    const { container } = renderWithClient(<RecommendationRail strategy="featured" />);

    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lists recently viewed products, most recent first, and appears as soon as something is viewed", async () => {
    renderWithClient(
      <>
        <RecommendationRail strategy="recently-viewed" />
        <RecommendationRail strategy="featured" />
      </>,
    );
    await screen.findByRole("heading", { name: "Featured Products" });
    expect(screen.queryByRole("heading", { name: "Recently Viewed" })).not.toBeInTheDocument();

    act(() => view(find(1)));
    act(() => view(find(2)));

    const section = await screen.findByRole("region", { name: "Recently Viewed" });
    await waitFor(() => expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["P2", "P1"]));
  });

  it("keeps an out-of-stock product that was viewed, marked as out of stock (PRD edge case 23)", async () => {
    act(() => view(find(11)));
    renderWithClient(<RecommendationRail strategy="recently-viewed" />);

    const section = await screen.findByRole("region", { name: "Recently Viewed" });
    expect(within(section).getByText("P11")).toBeInTheDocument();
    expect(within(section).getByText("Out of stock")).toBeInTheDocument();
  });

  it("never offers an out-of-stock product in Featured or Trending (PRD edge case 23)", async () => {
    renderWithClient(
      <>
        <RecommendationRail strategy="featured" limit={50} />
        <RecommendationRail strategy="trending" limit={50} />
      </>,
    );
    await screen.findByRole("region", { name: "Trending Now" });
    expect(screen.queryByText("P11")).not.toBeInTheDocument();
  });

  it("falls back to popular products with an honest heading when there is no activity, or hides when asked", async () => {
    const shown = renderWithClient(<RecommendationRail strategy="personalized" />);
    const section = await screen.findByRole("region", { name: "Popular Right Now" });
    expect(section).toHaveAttribute("data-fallback", "true");
    shown.unmount();

    renderWithClient(
      <>
        <RecommendationRail strategy="personalized" fallback="hide" />
        <RecommendationRail strategy="featured" />
      </>,
    );
    await screen.findByRole("heading", { name: "Featured Products" });
    expect(screen.queryByRole("heading", { name: "Popular Right Now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommended For You" })).not.toBeInTheDocument();
  });

  it("personalizes once there is activity, and each card says why", async () => {
    act(() => view(find(1)));
    act(() => view(find(2)));
    renderWithClient(<RecommendationRail strategy="personalized" />);

    const section = await screen.findByRole("region", { name: "Recommended For You" });
    expect(section).toHaveAttribute("data-fallback", "false");
    expect(within(section).getByText(/^Based on your browsing/)).toBeInTheDocument();
    expect(within(section).getAllByText(/Similar to P|Matches your interest|price range|Shares your interest|favour|Popular with shoppers|Highly rated/).length).toBeGreaterThan(0);
    expect(within(section).queryByText("P1")).not.toBeInTheDocument();
    expect(within(section).queryByText("P2")).not.toBeInTheDocument();
  });

  it("offers complementary add-ons for the cart, and wishlist-inspired picks for the wishlist", async () => {
    putInCart(find(8));
    putOnWishlist(find(17));
    renderWithClient(
      <>
        <RecommendationRail strategy="cart-based" />
        <RecommendationRail strategy="wishlist-based" />
      </>,
    );

    const cart = await screen.findByRole("region", { name: "Goes Well With Your Cart" });
    expect(within(cart).getByText("P12")).toBeInTheDocument();
    expect(within(cart).getAllByText("Goes with P8 in your cart").length).toBeGreaterThan(0);
    expect(within(cart).queryByText("P9")).not.toBeInTheDocument(); // another phone is not an add-on

    const wishlist = await screen.findByRole("region", { name: "Inspired By Your Wishlist" });
    expect(within(wishlist).getAllByText("Similar to P17 on your wishlist").length).toBeGreaterThan(0);
  });

  it("anchors a similar-products rail to a product, excluding it, with reasons", async () => {
    renderWithClient(<RecommendationRail strategy="similar" productId={1} />);

    const section = await screen.findByRole("region", { name: "Similar Products" });
    expect(within(section).queryByText("P1")).not.toBeInTheDocument();
    expect(within(section).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("P2");
    expect(within(section).getAllByText(/Same category: Mens Shoes/).length).toBeGreaterThan(0);
  });

  it("shows only as many products as exist, never padding with empty boxes", async () => {
    renderWithClient(<RecommendationRail strategy="category-based" categorySlug="womens-shoes" />);

    const section = await screen.findByRole("region", { name: "More in Womens Shoes" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
  });

  it("updates when the shopper's activity changes", async () => {
    renderWithClient(<RecommendationRail strategy="category-based" />);
    expect(screen.queryByRole("heading", { name: /Because You Browsed/ })).not.toBeInTheDocument();

    act(() => view(find(1)));
    act(() => view(find(2)));

    expect(await screen.findByRole("heading", { name: "Because You Browsed Mens Shoes" })).toBeInTheDocument();
  });
});

describe("ProductPageRecommendations (PRD 5.4)", () => {
  it("shows similar, bought-together, more-in-category and personalized rails, in that order", async () => {
    renderWithClient(<ProductPageRecommendations productId="8" />);

    await screen.findByRole("heading", { name: "Frequently Bought Together" });
    await screen.findByRole("heading", { name: "Popular Right Now" });
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["Similar Products", "Frequently Bought Together", "More in Smartphones", "Popular Right Now"]);
  });

  it("never includes the product being viewed or an out-of-stock one", async () => {
    renderWithClient(<ProductPageRecommendations productId="8" />);

    await screen.findByRole("heading", { name: "More in Smartphones" });
    expect(screen.queryByText("P8")).not.toBeInTheDocument();
    expect(screen.queryByText("P11")).not.toBeInTheDocument();
  });

  it("renders nothing for an invalid product id", () => {
    const { container } = renderWithClient(<ProductPageRecommendations productId="abc" />);
    expect(container.querySelector("section")).toBeNull();
  });
});
