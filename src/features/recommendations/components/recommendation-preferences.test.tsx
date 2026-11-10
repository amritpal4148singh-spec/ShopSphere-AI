import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SEARCH_HISTORY_KEY, addRecentSearch } from "@/lib/search-history";
import { PERSONALIZED_WEIGHTS } from "@/services/recommendations";
import { useCartStore } from "@/store/cart-store";
import { useViewedStore } from "@/store/viewed-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { buildCatalog } from "@/test/catalog";
import { putInCart, putOnWishlist, resetRecommendationWorld, view } from "@/test/recommendations";
import { renderWithClient } from "@/test/render";
import { RecommendationPreferences } from "./recommendation-preferences";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), fetchCategories: vi.fn() };
});

const catalog = buildCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;

function withActivity() {
  view(find(1));
  view(find(2));
  view(find(3));
  addRecentSearch("running shoes");
  putInCart(find(8));
  putOnWishlist(find(17));
}

beforeEach(() => resetRecommendationWorld(catalog));

describe("RecommendationPreferences (PRD 5.7, 6.1)", () => {
  it("says so plainly when there is no activity yet", () => {
    renderWithClient(<RecommendationPreferences />);

    expect(screen.getByRole("heading", { level: 2, name: "Recommendation preferences" })).toBeInTheDocument();
    expect(screen.getByText(/have not seen any activity on this device yet/)).toBeInTheDocument();
    expect(screen.getByText("Low (0%)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear viewing history" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear search history" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset all browsing signals" })).toBeDisabled();
  });

  it("lists what was viewed as links, most recent first", async () => {
    withActivity();
    renderWithClient(<RecommendationPreferences />);

    const section = await screen.findByRole("region", { name: "Because you viewed" });
    await within(section).findByRole("link", { name: "P3" });
    expect(within(section).getAllByRole("link").map((link) => link.textContent)).toEqual(["P3", "P2", "P1"]);
    expect(within(section).getByRole("link", { name: "P3" })).toHaveAttribute("href", "/products/3");
  });

  it("shows the typical price range, interests, searches and account activity", async () => {
    withActivity();
    renderWithClient(<RecommendationPreferences />);

    const price = await screen.findByRole("region", { name: "Your typical price range" });
    expect(await within(price).findByText(/^₹[\d,]+ to ₹[\d,]+$/)).toBeInTheDocument();

    const interests = screen.getByRole("region", { name: "Categories and brands you seem to like" });
    expect(await within(interests).findByText(/Mens Shoes: (strong|moderate) interest/)).toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: "From your searches" })).getByText("running shoes")).toBeInTheDocument();

    const account = screen.getByRole("region", { name: "Your account activity" });
    expect(within(account).getByRole("link", { name: "1 on your wishlist" })).toHaveAttribute("href", "/wishlist");
    expect(within(account).getByRole("link", { name: "1 in your cart" })).toHaveAttribute("href", "/cart");
    expect(within(account).getByRole("link", { name: "0 past orders" })).toHaveAttribute("href", "/orders");
  });

  it("shows how much is known, rising with activity", async () => {
    view(find(1));
    const first = renderWithClient(<RecommendationPreferences />);
    expect(await screen.findByText("Low (17%)")).toBeInTheDocument();
    first.unmount();

    withActivity();
    renderWithClient(<RecommendationPreferences />);
    expect(await screen.findByText("High (100%)")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "How much we know about your interests" })).toHaveAttribute("value", "1");
  });

  it("documents the score components and their weights, which add up to 100%", () => {
    renderWithClient(<RecommendationPreferences />);

    const table = screen.getByRole("table", { name: "Score components and weights", hidden: true });
    const rows = within(table).getAllByRole("row", { hidden: true }).slice(1);
    expect(rows).toHaveLength(Object.keys(PERSONALIZED_WEIGHTS).length);
    const total = rows.reduce((sum, row) => sum + Number.parseInt(within(row).getAllByRole("cell", { hidden: true })[1]!.textContent ?? "0", 10), 0);
    expect(total).toBe(100);
  });

  it("clears the viewing history and says so", async () => {
    const user = userEvent.setup();
    withActivity();
    renderWithClient(<RecommendationPreferences />);

    await user.click(screen.getByRole("button", { name: "Clear viewing history" }));

    expect(useViewedStore.getState().items).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Your viewing history was cleared.");
    expect(await screen.findByText("No products viewed yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear viewing history" })).toBeDisabled();
  });

  it("clears the search history and says so", async () => {
    const user = userEvent.setup();
    withActivity();
    renderWithClient(<RecommendationPreferences />);

    await user.click(screen.getByRole("button", { name: "Clear search history" }));

    expect(localStorage.getItem(SEARCH_HISTORY_KEY)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Your search history was cleared.");
    expect(await screen.findByText("No searches yet.")).toBeInTheDocument();
  });

  it("asks before resetting everything, and can be cancelled", async () => {
    const user = userEvent.setup();
    withActivity();
    renderWithClient(<RecommendationPreferences />);

    await user.click(screen.getByRole("button", { name: "Reset all browsing signals" }));
    expect(screen.getByRole("group", { name: "Confirm reset" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("group", { name: "Confirm reset" })).not.toBeInTheDocument();
    expect(useViewedStore.getState().items).toHaveLength(3);
  });

  it("resets viewing and search history together, and leaves wishlist, cart and orders alone", async () => {
    const user = userEvent.setup();
    withActivity();
    renderWithClient(<RecommendationPreferences />);

    await user.click(screen.getByRole("button", { name: "Reset all browsing signals" }));
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));

    expect(useViewedStore.getState().items).toEqual([]);
    expect(localStorage.getItem(SEARCH_HISTORY_KEY)).toBeNull();
    expect(useWishlistStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(/wishlist, cart and orders/);
    expect(screen.getByText("Your wishlist, cart and orders are not affected.")).toBeInTheDocument();
  });

  it("reacts to activity that happens while the page is open", async () => {
    renderWithClient(<RecommendationPreferences />);
    expect(screen.getByText(/have not seen any activity/)).toBeInTheDocument();

    act(() => view(find(1)));

    expect(screen.queryByText(/have not seen any activity/)).not.toBeInTheDocument();
  });
});
