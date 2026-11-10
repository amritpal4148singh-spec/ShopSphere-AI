import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProductCard } from "@/features/products";
import { ApiError, fetchProduct } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { useCompareStore } from "@/store/compare-store";
import { makeProduct, makeProductDetail } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { push, setNavigation, resetNavigation } from "@/test/navigation-mock";
import { CompareTray } from "./compare-tray";
import { CompareView } from "./compare-view";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);
vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchProduct: vi.fn() };
});

const lamp = makeProductDetail({ id: 1, warrantyInformation: null as unknown as string, title: "Brass Lamp", price: 1000, discountPercentage: 10, finalPrice: 900, rating: 4.6, stock: 12, category: "home-decoration", brand: "Lumen" });
const mug = makeProductDetail({ id: 2, title: "Clay Mug", price: 500, discountPercentage: 0, finalPrice: 500, rating: 4.1, stock: 0, availability: "out-of-stock", category: "kitchen-accessories", brand: null, warrantyInformation: "1 year" });
const byId: Record<number, ReturnType<typeof makeProductDetail>> = { 1: lamp, 2: mug };
const pick = (p: { id: number; title: string; thumbnail: string | null; category: string }) => ({ productId: p.id, title: p.title, thumbnail: p.thumbnail, category: p.category });

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  resetNavigation();
  vi.mocked(fetchProduct).mockReset().mockImplementation(async (id: number) => byId[id] ?? Promise.reject(new ApiError("http", "Not found", 404)));
  useCompareStore.setState({ status: "idle", items: [], lastOutcome: null });
  useCompareStore.getState().hydrate();
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  useCartStore.getState().switchOwner(null);
});

describe("ProductCard compare toggle", () => {
  it("adds and removes a product, announcing state with aria-pressed", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductCard product={makeProduct({ id: 7, title: "Desk" })} />);
    const toggle = screen.getByRole("button", { name: "Compare Desk" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Remove Desk from comparison" })).toHaveAttribute("aria-pressed", "true");
    expect(useCompareStore.getState().items.map((i) => i.productId)).toEqual([7]);
    await user.click(screen.getByRole("button", { name: "Remove Desk from comparison" }));
    expect(useCompareStore.getState().items).toEqual([]);
  });

  it("explains and blocks a fifth product", async () => {
    for (const n of [1, 2, 3, 4]) useCompareStore.getState().add({ productId: n, title: `P${n}`, thumbnail: null, category: "c" });
    const user = userEvent.setup();
    renderWithClient(<ProductCard product={makeProduct({ id: 9, title: "Fifth" })} />);
    const toggle = screen.getByRole("button", { name: /Comparison is full/ });
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    await user.click(toggle);
    expect(useCompareStore.getState().items).toHaveLength(4);
    expect(useCompareStore.getState().lastOutcome).toBe("full"); // the tray shows the explanation
  });
});

describe("CompareTray", () => {
  it("is hidden when nothing is selected", () => {
    renderWithClient(<CompareTray />);
    expect(screen.queryByRole("region", { name: "Product comparison" })).not.toBeInTheDocument();
  });

  it("asks for a second product, then links to /compare, and lets items be removed or cleared", async () => {
    const user = userEvent.setup();
    renderWithClient(<CompareTray />);
    act(() => void useCompareStore.getState().add(pick(lamp)));

    const tray = await screen.findByRole("region", { name: "Product comparison" });
    expect(within(tray).getByText("Compare (1/4)")).toBeInTheDocument();
    expect(within(tray).getByText(/1 product selected\. Select at least 2 products to compare\./)).toBeInTheDocument();
    expect(within(tray).getByRole("button", { name: "Compare now" })).toBeDisabled();

    act(() => void useCompareStore.getState().add(pick(mug)));
    expect(within(tray).getByText(/2 products selected\. Ready to compare\./)).toBeInTheDocument();
    await user.click(within(tray).getByRole("button", { name: "Compare now" }));
    expect(push).toHaveBeenCalledWith("/compare");
    act(() => setNavigation("/products")); // the mock navigated to /compare, where the tray hides itself

    const again = await screen.findByRole("region", { name: "Product comparison" });
    await user.click(within(again).getByRole("button", { name: "Remove Clay Mug from comparison" }));
    expect(useCompareStore.getState().items).toHaveLength(1);
    await user.click(within(again).getByRole("button", { name: "Clear" }));
    expect(screen.queryByRole("region", { name: "Product comparison" })).not.toBeInTheDocument();
  });

  it("stays out of the way on the compare page itself", () => {
    setNavigation("/compare");
    useCompareStore.getState().add(pick(lamp));
    renderWithClient(<CompareTray />);
    expect(screen.queryByRole("region", { name: "Product comparison" })).not.toBeInTheDocument();
  });
});

describe("CompareView", () => {
  it("asks for products when fewer than two are chosen", () => {
    useCompareStore.getState().add(pick(lamp));
    renderWithClient(<CompareView />);
    expect(screen.getByRole("heading", { name: "Choose one more product" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute("href", "/products");
  });

  it("renders an accessible side-by-side table with differences and best values marked", async () => {
    useCompareStore.getState().add(pick(lamp));
    useCompareStore.getState().add(pick(mug));
    renderWithClient(<CompareView />);

    const table = await screen.findByRole("table");
    expect(await within(table).findByRole("columnheader", { name: /Brass Lamp/ })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: /Clay Mug/ })).toBeInTheDocument();

    const priceRow = within(table).getByRole("row", { name: /Price/ });
    expect(within(priceRow).getByText("Differs")).toBeInTheDocument();
    expect(within(priceRow).getByText("Lowest price")).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Rating/ })).toHaveTextContent("Highest rated");
    expect(within(table).getByRole("row", { name: /Availability/ })).toHaveTextContent("In stockOut of stock");
    // Missing data is shown plainly.
    expect(within(table).getByRole("row", { name: /Brand/ })).toHaveTextContent("Not specified");
    expect(within(table).getByRole("row", { name: /Warranty/ })).toHaveTextContent("Not specified1 year");
  });

  it("can show only the rows that differ", async () => {
    useCompareStore.getState().add(pick(lamp));
    useCompareStore.getState().add(pick(mug));
    const user = userEvent.setup();
    renderWithClient(<CompareView />);
    await screen.findByRole("columnheader", { name: /Brass Lamp/ });
    const before = screen.getAllByRole("row").length;
    await user.click(screen.getByRole("checkbox", { name: "Show differences only" }));
    expect(screen.getAllByRole("row").length).toBeLessThan(before);
  });

  it("adds an in-stock product to the cart, disables the sold-out one, and links to the product page", async () => {
    useCompareStore.getState().add(pick(lamp));
    useCompareStore.getState().add(pick(mug));
    const user = userEvent.setup();
    renderWithClient(<CompareView />);

    await screen.findByRole("columnheader", { name: /Brass Lamp/ });
    expect(await screen.findByRole("button", { name: "Clay Mug is out of stock" })).toBeDisabled();
    await user.click(await screen.findByRole("button", { name: "Add Brass Lamp to cart" }));
    expect(screen.getByRole("status")).toHaveTextContent("Brass Lamp was added to your cart.");
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual([1]);
    expect(screen.getByRole("link", { name: "View Brass Lamp" })).toHaveAttribute("href", "/products/1");
  });

  it("keeps the table intact when a product is no longer available, and lets it be removed", async () => {
    useCompareStore.getState().add(pick(lamp));
    useCompareStore.getState().add({ productId: 99, title: "Ghost Item", thumbnail: null, category: "x" });
    const user = userEvent.setup();
    renderWithClient(<CompareView />);

    expect(await screen.findByText("No longer available.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Ghost Item from comparison" }));
    expect(await screen.findByRole("heading", { name: "Choose one more product" })).toBeInTheDocument();
  });

  it("restores the comparison from the session after a reload", async () => {
    useCompareStore.getState().add(pick(lamp));
    useCompareStore.getState().add(pick(mug));
    useCompareStore.setState({ status: "idle", items: [] });
    useCompareStore.getState().hydrate();
    renderWithClient(<CompareView />);
    expect(await screen.findByRole("columnheader", { name: /Clay Mug/ })).toBeInTheDocument();
  });
});
