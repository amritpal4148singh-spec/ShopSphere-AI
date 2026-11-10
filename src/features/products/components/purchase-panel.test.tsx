import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getVariantGroup } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { makeProductDetail } from "@/test/fixtures";
import { push, resetNavigation } from "@/test/navigation-mock";
import { PurchasePanel } from "./purchase-panel";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);

const addToCart = () => screen.getByRole("button", { name: "Add to Cart" });
const quantity = () => screen.getByRole("textbox", { name: "Quantity" });

beforeEach(() => {
  resetNavigation();
  localStorage.clear();
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  useCartStore.getState().switchOwner(null);
});

describe("PurchasePanel with variants (PRD MOD-04-001)", () => {
  // Product 3 is a multiple of 3, so exactly one size is sold out.
  const product = makeProductDetail({ id: 3, category: "mens-shoes", stock: 100 });
  const group = getVariantGroup(product)!;
  const soldOut = group.options.find((option) => option.stock === 0)!;
  const inStock = group.options.filter((option) => option.stock > 0);

  it("selects an in-stock size by default and enables the purchase actions", () => {
    render(<PurchasePanel product={product} />);

    expect(screen.getByRole("radio", { name: inStock[0]!.label })).toBeChecked();
    expect(addToCart()).toBeEnabled();
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeEnabled();
  });

  it("disables Add to Cart with an explanatory label when the selected variant has no stock", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={product} />);

    await user.click(screen.getByRole("radio", { name: `${soldOut.label} (out of stock)` }));

    const disabled = screen.getByRole("button", { name: "Out of stock" });
    expect(disabled).toBeDisabled();
    expect(disabled).toHaveAccessibleDescription("This size is out of stock. Choose another size to continue.");
    expect(screen.getByRole("button", { name: "Buy Now" })).toBeDisabled();
    expect(screen.getByText("Out of stock in this size")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  it("keeps the in-stock variants selectable and re-enables the actions", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={product} />);

    await user.click(screen.getByRole("radio", { name: `${soldOut.label} (out of stock)` }));
    expect(screen.queryByRole("button", { name: "Add to Cart" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: inStock[1]!.label }));

    expect(addToCart()).toBeEnabled();
    expect(screen.queryByText("Out of stock in this size")).not.toBeInTheDocument();
  });

  it("re-clamps the quantity when switching to a variant with less stock", async () => {
    const user = userEvent.setup();
    const stocked = [...inStock].sort((a, b) => b.stock - a.stock);
    const most = stocked[0]!;
    const least = stocked[stocked.length - 1]!;
    expect(least.stock).toBeLessThan(most.stock);

    render(<PurchasePanel product={product} />);
    await user.click(screen.getByRole("radio", { name: most.label }));
    await user.clear(quantity());
    await user.type(quantity(), `${most.stock}{Enter}`);
    expect(quantity()).toHaveValue(String(most.stock));

    await user.click(screen.getByRole("radio", { name: least.label }));

    expect(quantity()).toHaveValue(String(least.stock));
  });

  it("adds the selected variant to the cart as its own line", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={product} />);

    await user.click(screen.getByRole("radio", { name: inStock[1]!.label }));
    await user.click(addToCart());

    const [line] = useCartStore.getState().items;
    expect(line).toMatchObject({
      productId: 3,
      variantId: inStock[1]!.id,
      variantLabel: `Size: ${inStock[1]!.label}`,
      quantity: 1,
      knownStock: inStock[1]!.stock,
    });
  });
});

describe("PurchasePanel without variants", () => {
  const plain = (overrides = {}) => makeProductDetail({ category: "groceries", stock: 50, ...overrides });

  it("bounds the quantity by the stock and says so (low stock)", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={plain({ stock: 3 })} />);

    expect(screen.getByText("Only 3 left in stock")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));

    expect(quantity()).toHaveValue("3");
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(screen.getByText(/the maximum is 3/)).toBeInTheDocument();
  });

  it("disables purchase for an out-of-stock product and explains why (edge case 9)", () => {
    render(<PurchasePanel product={plain({ stock: 0, availability: "out-of-stock" })} />);

    expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled();
    expect(screen.getByText("This product is currently out of stock.")).toBeInTheDocument();
  });

  it("shows no variant selector when the product has no variants", () => {
    render(<PurchasePanel product={plain()} />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("adds to the cart, confirms it, and links to the cart", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={plain({ id: 5, title: "Pantry Jar" })} />);

    await user.click(addToCart());

    expect(screen.getByText("Added to your cart.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/cart");
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]).toMatchObject({ productId: 5, variantId: null, title: "Pantry Jar", unitPrice: 1000 });
  });

  it("adds the chosen quantity", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={plain()} />);

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(addToCart());

    expect(useCartStore.getState().items[0]?.quantity).toBe(3);
    expect(screen.getByText("Added 3 to your cart.")).toBeInTheDocument();
  });

  it("increments the existing line when the same product is added again (PRD edge case 8)", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={plain()} />);

    await user.click(addToCart());
    await user.click(addToCart());

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
    expect(screen.getByText(/already in your cart/)).toHaveTextContent("The quantity is now 2.");
  });

  it("limits the cart to the stock and says so", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={plain({ stock: 2 })} />);

    await user.click(addToCart());
    await user.click(addToCart());
    await user.click(addToCart());

    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
    expect(screen.getByText(/Only 2 available, so your cart now has 2/)).toBeInTheDocument();
  });

  it("Buy Now adds the item and goes to checkout", async () => {
    const user = userEvent.setup();
    render(<PurchasePanel product={plain()} />);

    await user.click(screen.getByRole("button", { name: "Buy Now" }));

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(push).toHaveBeenCalledWith("/checkout");
  });

  it("does not navigate when the cart is not ready yet, and says so", async () => {
    const user = userEvent.setup();
    useCartStore.setState({ status: "idle" });
    render(<PurchasePanel product={plain()} />);

    await user.click(screen.getByRole("button", { name: "Buy Now" }));

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/cart is still loading/i)).toBeInTheDocument();
  });
});
