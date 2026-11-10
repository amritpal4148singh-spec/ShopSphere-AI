import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useWishlistStore } from "@/store/wishlist-store";
import { makeProduct } from "@/test/fixtures";
import { ProductCard } from "./product-card";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useWishlistStore.setState({ status: "idle", ownerId: null, items: [] });
  useWishlistStore.getState().switchOwner(null);
});

describe("ProductCard", () => {
  it("shows the title as a link to the product, plus brand, rating and price", () => {
    render(<ProductCard product={makeProduct({ id: 42, title: "Trail Runner", brand: "Nike", rating: 4.46, finalPrice: 3400, price: 3400 })} />);

    expect(screen.getByRole("link", { name: "Trail Runner" })).toHaveAttribute("href", "/products/42");
    expect(screen.getByText("Nike")).toBeInTheDocument();
    expect(screen.getByLabelText("Rated 4.5 out of 5")).toBeInTheDocument();
    expect(screen.getByText("₹3,400")).toBeInTheDocument();
  });

  it("shows the original price struck through and a badge for sale items", () => {
    render(<ProductCard product={makeProduct({ price: 1000, discountPercentage: 20 })} />);

    expect(screen.getByText("₹800")).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toHaveClass("line-through");
    expect(screen.getByText("20% off")).toBeInTheDocument();
  });

  it("does not show a sale badge for small discounts", () => {
    render(<ProductCard product={makeProduct({ price: 1000, discountPercentage: 5 })} />);
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it("flags out-of-stock and low-stock products", () => {
    const { rerender } = render(<ProductCard product={makeProduct({ availability: "out-of-stock", stock: 0 })} />);
    expect(screen.getByText("Out of stock")).toBeInTheDocument();

    rerender(<ProductCard product={makeProduct({ availability: "low-stock", stock: 2 })} />);
    expect(screen.getByText("Only a few left")).toBeInTheDocument();
  });

  it("says so when a product has no ratings", () => {
    render(<ProductCard product={makeProduct({ rating: 0 })} />);
    expect(screen.getByText("No ratings yet")).toBeInTheDocument();
  });

  it("shows a placeholder when there is no image (edge case 20)", () => {
    render(<ProductCard product={makeProduct({ thumbnail: null })} />);
    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
  });

  it("swaps a broken image for the placeholder instead of a broken-image icon", () => {
    const { container } = render(<ProductCard product={makeProduct()} />);

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("says why a product is recommended when given a reason", () => {
    const { rerender } = render(<ProductCard product={makeProduct({ id: 3 })} reason="Similar to Trail Runner, which you viewed" />);
    expect(screen.getByText("Similar to Trail Runner, which you viewed")).toBeInTheDocument();

    rerender(<ProductCard product={makeProduct({ id: 3 })} />);
    expect(screen.queryByText(/Similar to/)).not.toBeInTheDocument();
  });

  it("has a wishlist heart that toggles and reflects the saved state", async () => {
    const user = userEvent.setup();
    render(<ProductCard product={makeProduct({ id: 7, title: "Trail Runner", finalPrice: 3400, price: 3400 })} />);

    const heart = screen.getByRole("button", { name: "Add Trail Runner to wishlist" });
    expect(heart).toHaveAttribute("aria-pressed", "false");

    await user.click(heart);

    expect(screen.getByRole("button", { name: "Remove Trail Runner from wishlist" })).toHaveAttribute("aria-pressed", "true");
    expect(useWishlistStore.getState().items).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Remove Trail Runner from wishlist" }));
    expect(useWishlistStore.getState().items).toEqual([]);
  });

  it("shows an already-saved product as saved", () => {
    useWishlistStore.getState().toggle({ productId: 7, title: "Trail Runner", brand: null, category: "x", thumbnail: null, price: 1, availability: "in-stock" });
    render(<ProductCard product={makeProduct({ id: 7, title: "Trail Runner" })} />);
    expect(screen.getByRole("button", { name: "Remove Trail Runner from wishlist" })).toHaveAttribute("aria-pressed", "true");
  });
});
