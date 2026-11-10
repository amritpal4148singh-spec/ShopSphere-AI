import { render, screen } from "@testing-library/react";

import { useWishlistStore } from "@/store/wishlist-store";
import { WishlistLink } from "./wishlist-link";

const entry = (productId: number) => ({
  productId,
  title: "T",
  brand: null,
  category: "x",
  thumbnail: null,
  savedPrice: 1,
  price: 1,
  availability: "in-stock" as const,
  addedAt: 1,
});

describe("WishlistLink", () => {
  it("links to the wishlist with the count in its accessible name", () => {
    useWishlistStore.setState({ status: "ready", ownerId: null, items: [] });
    const { rerender } = render(<WishlistLink />);
    expect(screen.getByRole("link", { name: "Wishlist, 0 items" })).toHaveAttribute("href", "/wishlist");

    useWishlistStore.setState({ items: [entry(1)] });
    rerender(<WishlistLink />);
    expect(screen.getByRole("link", { name: "Wishlist, 1 item" })).toBeInTheDocument();

    useWishlistStore.setState({ items: [entry(1), entry(2), entry(3)] });
    rerender(<WishlistLink />);
    expect(screen.getByRole("link", { name: "Wishlist, 3 items" })).toBeInTheDocument();
  });
});
