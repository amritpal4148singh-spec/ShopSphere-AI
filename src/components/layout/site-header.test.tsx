import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithClient } from "@/test/render";
import { useCartStore } from "@/store/cart-store";
import { useUiStore } from "@/store/ui-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);
vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

describe("SiteHeader", () => {
  beforeEach(() => {
    useUiStore.setState({ isMobileNavOpen: false });
  });

  it("renders the brand link to the homepage", () => {
    renderWithClient(<SiteHeader />);

    expect(screen.getByRole("link", { name: /shopsphere ai/i })).toHaveAttribute("href", "/");
  });

  it("includes the product search and a link to the shop", () => {
    renderWithClient(<SiteHeader />);

    expect(screen.getByRole("combobox", { name: "Search products" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Shop" })[0]).toHaveAttribute("href", "/products");
  });

  it("shows cart and wishlist icons with their item counts", () => {
    useCartStore.setState({ status: "ready", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
    useWishlistStore.setState({ status: "ready", ownerId: null, items: [] });
    renderWithClient(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Cart, 0 items" })).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: "Wishlist, 0 items" })).toHaveAttribute("href", "/wishlist");
  });

  it("opens and closes the mobile navigation with correct ARIA state", async () => {
    const user = userEvent.setup();
    renderWithClient(<SiteHeader />);

    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Mobile" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Close menu" }));

    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
  });
});
