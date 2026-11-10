import { render, screen } from "@testing-library/react";

import { useCartStore } from "@/store/cart-store";
import { CartLink } from "./cart-link";

const item = (quantity: number, key = "1:-") => ({
  key,
  productId: Number(key.split(":")[0]),
  variantId: null,
  variantLabel: null,
  quantity,
  title: "Item",
  brand: null,
  category: "x",
  thumbnail: null,
  unitPrice: 100,
  knownStock: 500,
  addedAt: 1,
});

function setCart(items: ReturnType<typeof item>[], status: "idle" | "ready" = "ready") {
  useCartStore.setState({ status, ownerId: null, items, saved: [], couponCode: null, notices: {} });
}

describe("CartLink", () => {
  it("links to the cart with an accessible name that includes the count", () => {
    setCart([]);
    render(<CartLink />);
    expect(screen.getByRole("link", { name: "Cart, 0 items" })).toHaveAttribute("href", "/cart");
  });

  it("counts every unit in the cart, with correct singular and plural", () => {
    setCart([item(1)]);
    const { rerender } = render(<CartLink />);
    expect(screen.getByRole("link", { name: "Cart, 1 item" })).toBeInTheDocument();

    setCart([item(2), item(3, "2:-")]);
    rerender(<CartLink />);
    expect(screen.getByRole("link", { name: "Cart, 5 items" })).toBeInTheDocument();
  });

  it("caps a very large visible count", () => {
    setCart([item(250)]);
    render(<CartLink />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("announces the count through a live region once the cart is ready", () => {
    setCart([item(2)]);
    render(<CartLink />);
    expect(screen.getByRole("status")).toHaveTextContent("2 items in cart");
  });

  it("announces nothing while the cart is still loading", () => {
    setCart([], "idle");
    render(<CartLink />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
