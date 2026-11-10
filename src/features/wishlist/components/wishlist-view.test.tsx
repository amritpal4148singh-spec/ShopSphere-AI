import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchCatalog } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { makeProduct } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { recommendationService } from "@/services/recommendations";
import type { NewWishlistItem } from "@/types/cart";
import { WishlistView } from "./wishlist-view";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const lamp = makeProduct({ id: 1, title: "Alpha Lamp", category: "groceries", stock: 10, price: 1000, finalPrice: 1000 });
const mug = makeProduct({ id: 2, title: "Bravo Mug", category: "groceries", stock: 3, price: 500, finalPrice: 500, availability: "low-stock" });

const saved = (overrides: Partial<NewWishlistItem> = {}): NewWishlistItem => ({
  productId: 1,
  title: "Alpha Lamp",
  brand: "Acme",
  category: "groceries",
  thumbnail: null,
  price: 1000,
  availability: "in-stock",
  ...overrides,
});

function seed(owner: string | null, ...items: NewWishlistItem[]) {
  useWishlistStore.getState().switchOwner(owner);
  for (const item of items) useWishlistStore.getState().toggle(item);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useWishlistStore.setState({ status: "idle", ownerId: null, items: [] });
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  useCartStore.getState().switchOwner(null);
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue([lamp, mug]);
});

describe("WishlistView", () => {
  it("shows a skeleton until the wishlist is ready", () => {
    renderWithClient(<WishlistView />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your wishlist");
  });

  it("shows an empty state with a way to keep shopping", () => {
    seed("u1");
    renderWithClient(<WishlistView />);

    expect(screen.getByRole("heading", { name: "Your wishlist is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse Products" })).toHaveAttribute("href", "/products");
  });

  it("tells a guest the wishlist lasts for this session only and offers sign-in (PRD 4.3)", () => {
    seed(null);
    renderWithClient(<WishlistView />);

    expect(screen.getByText(/kept for this browser session only/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fwishlist");
  });

  it("does not show the guest note to a signed-in customer", () => {
    seed("u1");
    renderWithClient(<WishlistView />);
    expect(screen.queryByText(/session only/)).not.toBeInTheDocument();
  });

  it("shows the current price and stock status of each saved product (PRD 5.9)", async () => {
    seed("u1", saved(), saved({ productId: 2, title: "Bravo Mug", price: 700 }));
    renderWithClient(<WishlistView />);

    expect(await screen.findByRole("link", { name: "Alpha Lamp" })).toHaveAttribute("href", "/products/1");
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
    expect(screen.getAllByText("In stock")).toHaveLength(2);
    // The mug now costs ₹500 (was ₹700 when saved) and is low on stock.
    expect(await screen.findByText("₹500")).toBeInTheDocument();
    expect(screen.getByText("was ₹700 when saved")).toBeInTheDocument();
    expect(screen.getByText("Only a few left")).toBeInTheDocument();
  });

  it("marks an item that went out of stock and disables Move to Cart (PRD MOD-09-001)", async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([makeProduct({ ...lamp, stock: 0, availability: "out-of-stock" }), mug]);
    seed("u1", saved());
    renderWithClient(<WishlistView />);

    expect(await screen.findAllByText("Out of stock")).not.toHaveLength(0);
    const move = screen.getByRole("button", { name: "Move to Cart" });
    expect(move).toBeDisabled();
    expect(move).toHaveAccessibleDescription("Out of stock items cannot be moved to the cart.");
    expect(screen.getByRole("link", { name: "Alpha Lamp" })).toBeInTheDocument();
  });

  it("marks a product the API no longer returns as unavailable, still removable", async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([mug]);
    seed("u1", saved());
    renderWithClient(<WishlistView />);

    expect((await screen.findAllByText("No longer available")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Alpha Lamp" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move to Cart" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Alpha Lamp from wishlist" })).toBeEnabled();
  });

  it("moves an item to the cart and removes it from the wishlist", async () => {
    const user = userEvent.setup();
    seed("u1", saved());
    renderWithClient(<WishlistView />);
    await screen.findByRole("link", { name: "Alpha Lamp" });

    await user.click(screen.getByRole("button", { name: "Move to Cart" }));

    expect(useCartStore.getState().items[0]).toMatchObject({ productId: 1, quantity: 1, unitPrice: 1000 });
    expect(useWishlistStore.getState().items).toEqual([]);
    expect(await screen.findByRole("heading", { name: "Your wishlist is empty" })).toBeInTheDocument();
  });

  it("picks the first in-stock variant when moving a product that has variants", async () => {
    const user = userEvent.setup();
    const shoe = makeProduct({ id: 3, title: "Trail Runner", category: "mens-shoes", stock: 100, price: 3400, finalPrice: 3400 });
    vi.mocked(fetchCatalog).mockResolvedValue([shoe]);
    seed("u1", saved({ productId: 3, title: "Trail Runner", category: "mens-shoes", price: 3400 }));
    renderWithClient(<WishlistView />);
    await screen.findByRole("link", { name: "Trail Runner" });

    await user.click(screen.getByRole("button", { name: "Move to Cart" }));

    const line = useCartStore.getState().items[0];
    expect(line?.variantId).toMatch(/^size-/);
    expect(line?.variantLabel).toMatch(/^Size: /);
    expect(line?.knownStock).toBeGreaterThan(0);
  });

  it("removes an item", async () => {
    const user = userEvent.setup();
    seed("u1", saved());
    renderWithClient(<WishlistView />);

    await user.click(await screen.findByRole("button", { name: "Remove Alpha Lamp from wishlist" }));

    expect(useWishlistStore.getState().items).toEqual([]);
  });

  it("shows last-known data with a retry banner when the API is down, and cannot move items meanwhile", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "down"));
    seed("u1", saved());
    renderWithClient(<WishlistView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not check the latest prices and stock");
    expect(screen.getByRole("link", { name: "Alpha Lamp" })).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move to Cart" })).toBeDisabled();
    expect(screen.getByText("Reconnect to move items to your cart.")).toBeInTheDocument();

    vi.mocked(fetchCatalog).mockResolvedValue([lamp, mug]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Move to Cart" })).toBeEnabled();
  });
});

describe("wishlist-inspired recommendations (PRD 5.9, 6.3)", () => {
  const desk = makeProduct({ id: 60, title: "Oak Desk", category: "furniture", stock: 10, price: 8000, finalPrice: 8000, tags: ["desk"] });
  const pine = makeProduct({ id: 62, title: "Pine Desk", category: "furniture", stock: 10, price: 7000, finalPrice: 7000, tags: ["desk"] });

  beforeEach(() => {
    recommendationService.clearCache();
    vi.mocked(fetchCatalog).mockResolvedValue([desk, pine]);
  });

  it("offers products related to the wishlist, never the wishlisted product itself", async () => {
    seed("u1", saved({ productId: 60, title: "Oak Desk", category: "furniture", price: 8000 }));
    renderWithClient(<WishlistView />);

    const rail = await screen.findByRole("region", { name: "Inspired By Your Wishlist" });
    expect(within(rail).getByText("Pine Desk")).toBeInTheDocument();
    expect(within(rail).queryByText("Oak Desk")).not.toBeInTheDocument();
    expect(within(rail).getByText("Similar to Oak Desk on your wishlist")).toBeInTheDocument();
  });

  it("has no rail for an empty wishlist", () => {
    seed("u1");
    renderWithClient(<WishlistView />);
    expect(screen.queryByRole("region", { name: "Inspired By Your Wishlist" })).not.toBeInTheDocument();
  });
});
