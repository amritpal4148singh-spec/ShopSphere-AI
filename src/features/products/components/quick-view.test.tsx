import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiError, fetchProduct } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { makeProduct, makeProductDetail } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { ProductCard } from "./product-card";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);
vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchProduct: vi.fn() };
});

const base = { id: 21, title: "Brass Lamp", price: 1000, discountPercentage: 10, finalPrice: 900, stock: 6, category: "home-decoration" };
const card = () => <ProductCard product={makeProduct(base)} />;
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Quick view Brass Lamp" }));
  return screen.findByRole("dialog", { name: "Brass Lamp" });
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchProduct).mockReset().mockResolvedValue(makeProductDetail(base));
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  useCartStore.getState().switchOwner(null);
});

describe("Quick View (PRD 5.2)", () => {
  it("opens from the card without navigating, showing price, rating, stock and a full-details link", async () => {
    const user = userEvent.setup();
    renderWithClient(card());
    const dialog = await open(user);

    expect(await within(dialog).findByText("₹900")).toBeInTheDocument();
    expect(within(dialog).getByText("10% off")).toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "View full details" })).toHaveAttribute("href", "/products/21");
    expect(fetchProduct).toHaveBeenCalledWith(21, expect.anything());
  });

  it("shows a loading state, then adds to the shared cart and offers the cart link", async () => {
    const user = userEvent.setup();
    renderWithClient(card());
    const dialog = await open(user);
    await user.click(await within(dialog).findByRole("button", { name: "Add to Cart" }));

    expect(useCartStore.getState().items.map((i) => [i.productId, i.quantity])).toEqual([[21, 1]]);
    expect(within(dialog).getByText("Added to your cart.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "View cart" })).toHaveAttribute("href", "/cart");
  });

  it("does not create a second line for a repeat add: the quantity goes up instead", async () => {
    const user = userEvent.setup();
    renderWithClient(card());
    const dialog = await open(user);
    const add = await within(dialog).findByRole("button", { name: "Add to Cart" });
    await user.click(add);
    await user.click(add);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
  });

  it("never adds more than the stock allows", async () => {
    vi.mocked(fetchProduct).mockResolvedValue(makeProductDetail({ ...base, stock: 1, category: "home-decoration" }));
    const user = userEvent.setup();
    renderWithClient(card());
    const dialog = await open(user);
    const add = await within(dialog).findByRole("button", { name: "Add to Cart" });
    await user.click(add);
    await user.click(add);
    expect(useCartStore.getState().items[0]?.quantity).toBe(1);
  });

  it("disables adding and explains why when a product is out of stock", async () => {
    vi.mocked(fetchProduct).mockResolvedValue(makeProductDetail({ ...base, stock: 0, availability: "out-of-stock" }));
    const user = userEvent.setup();
    renderWithClient(card());
    const dialog = await open(user);
    const add = await within(dialog).findByRole("button", { name: "Out of stock" });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription(/.+/);
  });

  it("supports variant selection where the product has variants", async () => {
    vi.mocked(fetchProduct).mockResolvedValue(makeProductDetail({ ...base, category: "mens-shirts", stock: 20 }));
    const user = userEvent.setup();
    renderWithClient(<ProductCard product={makeProduct({ ...base, category: "mens-shirts", stock: 20 })} />);
    const dialog = await open(user);

    const radios = await within(dialog).findAllByRole("radio");
    expect(radios.length).toBeGreaterThan(1);
    const available = radios.filter((radio) => !radio.closest("label")?.textContent?.includes("out of stock"));
    await user.click(available[available.length - 1]!);
    await user.click(within(dialog).getByRole("button", { name: "Add to Cart" }));
    expect(useCartStore.getState().items[0]?.variantId).not.toBeNull();
  });

  it("shows an error with retry when loading fails, then recovers", async () => {
    vi.mocked(fetchProduct).mockRejectedValueOnce(new ApiError("network", "offline")).mockRejectedValueOnce(new ApiError("network", "offline")).mockResolvedValue(makeProductDetail(base));
    const user = userEvent.setup();
    renderWithClient(card());
    const dialog = await open(user);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("could not load");
    await user.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(await within(dialog).findByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
  });

  it("says so when the product no longer exists", async () => {
    vi.mocked(fetchProduct).mockRejectedValue(new ApiError("http", "Not found", 404));
    const user = userEvent.setup();
    renderWithClient(card());
    const dialog = await open(user);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("no longer available");
    expect(within(dialog).queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("closes with Escape and gives focus back to the Quick view button", async () => {
    const user = userEvent.setup();
    renderWithClient(card());
    const trigger = screen.getByRole("button", { name: "Quick view Brass Lamp" });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
