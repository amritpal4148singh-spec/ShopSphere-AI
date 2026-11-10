import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchCatalog } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { makeProduct } from "@/test/fixtures";
import { recommendationService } from "@/services/recommendations";
import { renderWithClient } from "@/test/render";
import type { NewCartItem } from "@/types/cart";
import { CartView } from "./cart-view";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const lamp = makeProduct({ id: 1, title: "Alpha Lamp", category: "groceries", stock: 10, price: 1000, finalPrice: 1000 });
const mug = makeProduct({ id: 2, title: "Bravo Mug", category: "groceries", stock: 3, price: 500, finalPrice: 500 });

function cartItem(overrides: Partial<NewCartItem> = {}): NewCartItem {
  return {
    productId: 1,
    variantId: null,
    variantLabel: null,
    quantity: 1,
    title: "Alpha Lamp",
    brand: "Acme",
    category: "groceries",
    thumbnail: null,
    unitPrice: 1000,
    knownStock: 10,
    ...overrides,
  };
}

const mugItem = (overrides: Partial<NewCartItem> = {}) =>
  cartItem({ productId: 2, title: "Bravo Mug", unitPrice: 500, knownStock: 3, ...overrides });

function seed(...items: NewCartItem[]) {
  useCartStore.getState().switchOwner(null);
  for (const item of items) useCartStore.getState().addItem(item);
}

const summary = () => within(screen.getByRole("complementary", { name: "Order summary" }));
const total = () => screen.getByTestId("cart-total");

beforeEach(() => {
  localStorage.clear();
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue([lamp, mug]);
});

describe("CartView basics", () => {
  it("shows a skeleton until the cart is ready", () => {
    renderWithClient(<CartView />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your cart");
  });

  it("shows a friendly empty state with a way to keep shopping", () => {
    useCartStore.getState().switchOwner(null);
    renderWithClient(<CartView />);

    expect(screen.getByRole("heading", { name: "Your cart is empty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse Products" })).toHaveAttribute("href", "/products");
    expect(screen.queryByRole("complementary", { name: "Order summary" })).not.toBeInTheDocument();
  });

  it("lists the lines with the order summary (simulated shipping and tax)", async () => {
    seed(cartItem({ quantity: 2 }), mugItem());
    renderWithClient(<CartView />);

    expect(await screen.findByRole("link", { name: "Alpha Lamp" })).toHaveAttribute("href", "/products/1");
    expect(screen.getByRole("link", { name: "Bravo Mug" })).toBeInTheDocument();

    expect(summary().getByText("Subtotal (3 items)")).toBeInTheDocument();
    expect(summary().getByText("Free")).toBeInTheDocument();
    expect(summary().getByText("₹450")).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹2,950");
  });

  it("offers checkout when nothing needs attention", async () => {
    seed(cartItem());
    renderWithClient(<CartView />);

    expect(await screen.findByRole("link", { name: "Proceed to Checkout" })).toHaveAttribute("href", "/checkout");
  });
});

describe("quantity and stock (PRD MOD-05-001)", () => {
  it("clamps a quantity above the stock, explains it inline, and the totals use the corrected quantity", async () => {
    const user = userEvent.setup();
    seed(mugItem());
    renderWithClient(<CartView />);
    const field = await screen.findByRole("textbox", { name: "Quantity for Bravo Mug" });

    await user.clear(field);
    await user.type(field, "9{Enter}");

    expect(await screen.findByText("You asked for 9, but only 3 are in stock. The quantity is now 3.")).toBeInTheDocument();
    expect(field).toHaveValue("3");
    expect(useCartStore.getState().items[0]?.quantity).toBe(3);
    expect(summary().getByText("Subtotal (3 items)")).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹1,770");
  });

  it("changes the quantity within the stock and updates the total", async () => {
    const user = userEvent.setup();
    seed(cartItem());
    renderWithClient(<CartView />);

    await user.click(await screen.findByRole("button", { name: "Increase quantity" }));

    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
    expect(summary().getByText("Subtotal (2 items)")).toBeInTheDocument();
  });

  it("says when the maximum has been reached", async () => {
    seed(mugItem({ quantity: 3 }));
    renderWithClient(<CartView />);

    expect(await screen.findByText("That is all we have: the maximum is 3.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  });

  it("reduces a quantity that live stock no longer supports, with a notice that can be dismissed", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog).mockResolvedValue([makeProduct({ ...lamp, stock: 2 }), mug]);
    seed(cartItem({ quantity: 5 }));
    renderWithClient(<CartView />);

    expect(await screen.findByText(/Only 2 are in stock now, so the quantity was reduced to 2/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Quantity for Alpha Lamp" })).toHaveValue("2");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/quantity was reduced/)).not.toBeInTheDocument();
  });
});

describe("failure states (PRD 5.5)", () => {
  it("flags an out-of-stock line in place and blocks checkout until it is removed", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog).mockResolvedValue([makeProduct({ ...lamp, stock: 0, availability: "out-of-stock" }), mug]);
    seed(cartItem(), mugItem());
    renderWithClient(<CartView />);

    expect(await screen.findByText("Out of stock.")).toBeInTheDocument();
    expect(screen.getByText(/Remove it or save it for later to continue/)).toBeInTheDocument();

    const checkout = screen.getByRole("button", { name: "Proceed to Checkout" });
    expect(checkout).toBeDisabled();
    expect(checkout).toHaveAccessibleDescription(/Alpha Lamp is out of stock/);
    expect(summary().getByText("Subtotal (1 item)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove Alpha Lamp from cart" }));

    expect(await screen.findByRole("link", { name: "Proceed to Checkout" })).toBeInTheDocument();
  });

  it("flags a product the API no longer returns, with a Remove action and no link (edge case 1)", async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([mug]);
    seed(cartItem(), mugItem());
    renderWithClient(<CartView />);

    expect(await screen.findByText("No longer available.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alpha Lamp" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proceed to Checkout" })).toHaveAccessibleDescription(/Alpha Lamp is no longer available/);
    expect(screen.getByRole("button", { name: "Remove Alpha Lamp from cart" })).toBeEnabled();
  });

  it("shows the new price and asks for confirmation before checkout (edge case 10)", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog).mockResolvedValue([makeProduct({ ...lamp, price: 1200, finalPrice: 1200 }), mug]);
    seed(cartItem());
    renderWithClient(<CartView />);

    expect(await screen.findByText("Price changed.")).toBeInTheDocument();
    expect(screen.getByText("It was ₹1,000 and is now ₹1,200.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proceed to Checkout" })).toBeDisabled();
    expect(total()).toHaveTextContent("₹1,416");

    await user.click(screen.getByRole("button", { name: "Accept new price" }));

    expect(await screen.findByRole("link", { name: "Proceed to Checkout" })).toBeInTheDocument();
    expect(useCartStore.getState().items[0]?.unitPrice).toBe(1200);
    expect(screen.queryByText("Price changed.")).not.toBeInTheDocument();
  });

  it("falls back to the last-known cart details with a retry banner when the API is down (PRD 5.5)", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("network", "down"));
    seed(cartItem({ quantity: 2 }));
    renderWithClient(<CartView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not check the latest prices and stock");
    expect(screen.getByRole("link", { name: "Alpha Lamp" })).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹2,360");

    vi.mocked(fetchCatalog).mockResolvedValue([lamp, mug]);
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});

describe("coupons (PRD 5.5)", () => {
  async function setup(...items: NewCartItem[]) {
    const user = userEvent.setup();
    seed(...items);
    renderWithClient(<CartView />);
    await screen.findByRole("link", { name: "Alpha Lamp" });
    return user;
  }

  const apply = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
    await user.clear(screen.getByLabelText("Coupon code"));
    await user.type(screen.getByLabelText("Coupon code"), code);
    await user.click(screen.getByRole("button", { name: "Apply" }));
  };

  it("rejects an unknown code with an inline message", async () => {
    const user = await setup(cartItem());
    await apply(user, "NOPE");

    expect(screen.getByLabelText("Coupon code")).toHaveAccessibleDescription('"NOPE" is not a valid coupon code.');
    expect(useCartStore.getState().couponCode).toBeNull();
  });

  it("rejects an expired code and says when it expired", async () => {
    const user = await setup(cartItem());
    await apply(user, "SUMMER25");

    expect(screen.getByLabelText("Coupon code")).toHaveAccessibleDescription(/SUMMER25 expired on/);
  });

  it("explains how much more is needed for a minimum-order code", async () => {
    const user = await setup(cartItem());
    await apply(user, "WELCOME200");

    expect(screen.getByLabelText("Coupon code")).toHaveAccessibleDescription(/needs a subtotal of at least ₹1,500\. Add ₹500 more/);
  });

  it("rejects an empty code", async () => {
    const user = await setup(cartItem());
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(screen.getByLabelText("Coupon code")).toHaveAccessibleDescription("Enter a coupon code.");
  });

  it("applies a valid code case-insensitively, shows the saving, and updates the total", async () => {
    const user = await setup(cartItem());
    await apply(user, "save10");

    expect(await screen.findByText("SAVE10 applied. You save ₹100.")).toBeInTheDocument();
    expect(summary().getByText("-₹100")).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹1,161");
    expect(useCartStore.getState().couponCode).toBe("SAVE10");
  });

  it("removes an applied code", async () => {
    const user = await setup(cartItem());
    await apply(user, "SAVE10");
    await user.click(await screen.findByRole("button", { name: "Remove" }));

    expect(screen.getByLabelText("Coupon code")).toBeInTheDocument();
    expect(total()).toHaveTextContent("₹1,180");
    expect(useCartStore.getState().couponCode).toBeNull();
  });

  it("explains a stored code that no longer qualifies after the cart changed", async () => {
    useCartStore.getState().switchOwner(null);
    useCartStore.getState().addItem(cartItem());
    useCartStore.getState().applyCoupon("WELCOME200");
    renderWithClient(<CartView />);

    expect(await screen.findByText(/WELCOME200 needs a subtotal of at least ₹1,500/)).toBeInTheDocument();
    expect(summary().queryByText(/^-₹/)).not.toBeInTheDocument();
  });
});

describe("save for later (PRD 5.5)", () => {
  it("moves a line out of the cart and back", async () => {
    const user = userEvent.setup();
    seed(cartItem());
    renderWithClient(<CartView />);

    await user.click(await screen.findByRole("button", { name: "Save for later" }));

    expect(screen.getByRole("heading", { name: "Your cart is empty" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Saved for later (1)" })).toBeInTheDocument();
    expect(useCartStore.getState().items).toEqual([]);

    await user.click(await screen.findByRole("button", { name: "Move to cart" }));

    expect(await screen.findByRole("textbox", { name: "Quantity for Alpha Lamp" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Saved for later/ })).not.toBeInTheDocument();
  });

  it("does not allow moving a saved item that is out of stock", async () => {
    vi.mocked(fetchCatalog).mockResolvedValue([makeProduct({ ...lamp, stock: 0, availability: "out-of-stock" }), mug]);
    seed(cartItem());
    useCartStore.getState().saveForLater("1:-");
    renderWithClient(<CartView />);

    expect(await screen.findByText("Out of stock.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move to cart" })).toBeDisabled();
  });

  it("removes a saved item", async () => {
    const user = userEvent.setup();
    seed(cartItem());
    useCartStore.getState().saveForLater("1:-");
    renderWithClient(<CartView />);

    await user.click(await screen.findByRole("button", { name: "Remove Alpha Lamp from saved items" }));

    expect(useCartStore.getState().saved).toEqual([]);
  });
});

describe("add-on recommendations in the cart (PRD 5.5, 6.3)", () => {
  const desk = makeProduct({ id: 60, title: "Oak Desk", category: "furniture", stock: 10, price: 8000, finalPrice: 8000, tags: ["desk"] });
  const lampDecor = makeProduct({ id: 61, title: "Brass Vase", category: "home-decoration", stock: 10, price: 900, finalPrice: 900, tags: ["decor"] });
  const sameKind = makeProduct({ id: 62, title: "Pine Desk", category: "furniture", stock: 10, price: 7000, finalPrice: 7000, tags: ["desk"] });

  beforeEach(() => {
    recommendationService.clearCache();
    vi.mocked(fetchCatalog).mockResolvedValue([desk, lampDecor, sameKind]);
  });

  it("offers products that go with what is in the cart, but not near-duplicates of it", async () => {
    seed(cartItem({ productId: 60, title: "Oak Desk", unitPrice: 8000, knownStock: 10, quantity: 1 }));
    renderWithClient(<CartView />);

    const rail = await screen.findByRole("region", { name: "Goes Well With Your Cart" });
    expect(within(rail).getByText("Brass Vase")).toBeInTheDocument();
    expect(within(rail).queryByText("Pine Desk")).not.toBeInTheDocument();
    expect(within(rail).getByText("Goes with Oak Desk in your cart")).toBeInTheDocument();
  });

  it("has no rail for an empty cart", async () => {
    useCartStore.getState().switchOwner(null);
    renderWithClient(<CartView />);

    await screen.findByRole("heading", { name: "Your cart is empty" });
    expect(screen.queryByRole("region", { name: "Goes Well With Your Cart" })).not.toBeInTheDocument();
  });
});
