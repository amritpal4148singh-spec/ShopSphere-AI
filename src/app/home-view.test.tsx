import { act, screen, waitFor, within } from "@testing-library/react";

import { fetchCategories } from "@/services/products";
import { buildCatalog } from "@/test/catalog";
import { putOnWishlist, resetRecommendationWorld, view } from "@/test/recommendations";
import { renderWithClient } from "@/test/render";
import { HomeView } from "./home-view";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), fetchCategories: vi.fn(), searchProducts: vi.fn(), fetchSuggestions: vi.fn() };
});

const catalog = buildCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;
const headings = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

beforeEach(() => {
  resetRecommendationWorld(catalog);
  vi.mocked(fetchCategories).mockResolvedValue([
    { slug: "mens-shoes", name: "Mens Shoes" },
    { slug: "smartphones", name: "Smartphones" },
  ]);
});

describe("HomeView: a first-time visitor (PRD MOD-01-001)", () => {
  it("sees Featured and Trending products, with nothing personalized pretending to be personal", async () => {
    renderWithClient(<HomeView />);

    await screen.findByRole("heading", { level: 2, name: "Trending Now" });
    expect(headings()).toEqual(["Featured Products", "Trending Now"]);
    expect(screen.queryByRole("heading", { name: "Recently Viewed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommended For You" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Popular Right Now" })).not.toBeInTheDocument();
  });

  it("has a clear way into the catalogue and the deals", async () => {
    renderWithClient(<HomeView />);

    expect(screen.getByRole("heading", { level: 1, name: "ShopSphere AI" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute("href", "/products");
    expect(screen.getByRole("link", { name: "Shop deals" })).toHaveAttribute("href", "/products?onSale=1&sort=rating");
    expect(await screen.findByRole("link", { name: "Mens Shoes" })).toHaveAttribute("href", "/category/mens-shoes");
  });
});

describe("HomeView: a returning visitor with history (PRD MOD-01-002)", () => {
  async function renderReturning() {
    act(() => view(find(1)));
    act(() => view(find(2)));
    act(() => view(find(3)));
    renderWithClient(<HomeView />);
    await screen.findByRole("heading", { level: 2, name: "Recently Viewed" });
    await screen.findByRole("heading", { level: 2, name: "Recommended For You" });
  }

  it("shows Recently Viewed with the most recent product first", async () => {
    await renderReturning();

    const section = screen.getByRole("region", { name: "Recently Viewed" });
    expect(within(section).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["P3", "P2", "P1"]);
  });

  it("shows personalized rails that reflect the categories viewed, and says what they are based on", async () => {
    await renderReturning();

    expect(await screen.findByRole("heading", { level: 2, name: "Because You Browsed Mens Shoes" })).toBeInTheDocument();
    const personalized = screen.getByRole("region", { name: "Recommended For You" });
    expect(within(personalized).getByText(/^Based on your browsing/)).toBeInTheDocument();
    expect(within(personalized).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(/^P(4|5)$/);
  });

  it("does not repeat a product the visitor already viewed in the personalized rails", async () => {
    await renderReturning();

    for (const name of ["Recommended For You", "Because You Browsed Mens Shoes"]) {
      const section = screen.getByRole("region", { name });
      for (const seen of ["P1", "P2", "P3"]) expect(within(section).queryByText(seen)).not.toBeInTheDocument();
    }
  });

  it("offers a price-range rail naming the range", async () => {
    await renderReturning();
    expect(await screen.findByRole("heading", { level: 2, name: /^In Your Price Range \(₹[\d,]+ to ₹[\d,]+\)$/ })).toBeInTheDocument();
  });

  it("adds a wishlist-inspired rail once something is on the wishlist", async () => {
    await renderReturning();
    expect(screen.queryByRole("heading", { name: "Inspired By Your Wishlist" })).not.toBeInTheDocument();

    act(() => putOnWishlist(find(17)));

    expect(await screen.findByRole("heading", { level: 2, name: "Inspired By Your Wishlist" })).toBeInTheDocument();
  });

  it("falls back to a first-time homepage when the history is cleared", async () => {
    await renderReturning();

    act(() => {
      localStorage.clear();
    });
    const { useViewedStore } = await import("@/store/viewed-store");
    act(() => useViewedStore.getState().clear());

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Recently Viewed" })).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Recommended For You" })).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 2, name: "Trending Now" }),
    ).toBeInTheDocument();
  });
});
