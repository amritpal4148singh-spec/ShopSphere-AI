import { act, renderHook } from "@testing-library/react";

import { addRecentSearch } from "@/lib/search-history";
import { EMPTY_RAW_SIGNALS } from "@/services/recommendations";
import { useOrdersStore } from "@/store/orders-store";
import { buildCatalog } from "@/test/catalog";
import { makeOrder } from "@/test/orders";
import { putInCart, putOnWishlist, resetRecommendationWorld, view } from "@/test/recommendations";
import { useRawSignals } from "./use-raw-signals";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), fetchCategories: vi.fn() };
});

const catalog = buildCatalog();
const find = (id: number) => catalog.find((product) => product.id === id)!;

beforeEach(() => resetRecommendationWorld(catalog));

describe("useRawSignals", () => {
  it("is the shared empty value when there is no activity", () => {
    const { result } = renderHook(() => useRawSignals());
    expect(result.current).toBe(EMPTY_RAW_SIGNALS);
  });

  it("collects views, searches, wishlist, cart and orders as plain data", () => {
    view(find(1));
    addRecentSearch("running shoes");
    putOnWishlist(find(17));
    putInCart(find(8));
    useOrdersStore.getState().switchOwner("u1");
    useOrdersStore.setState({ orders: [makeOrder()] });

    const { result } = renderHook(() => useRawSignals());

    expect(result.current.viewed.map((entry) => entry.productId)).toEqual([1]);
    expect(result.current.searches).toEqual(["running shoes"]);
    expect(result.current.wishlist).toEqual([{ productId: 17, category: "beauty", brand: "Essence", price: 850 }]);
    expect(result.current.cart).toEqual([{ productId: 8, quantity: 1, category: "smartphones", price: 45000 }]);
    expect(result.current.orders[0]?.items.map((item) => item.productId)).toEqual([1, 2]);
  });

  it("updates when a view is recorded or a search is added or cleared", () => {
    const { result } = renderHook(() => useRawSignals());
    expect(result.current.viewed).toEqual([]);

    act(() => view(find(2)));
    expect(result.current.viewed.map((entry) => entry.productId)).toEqual([2]);

    act(() => {
      addRecentSearch("laptops");
    });
    expect(result.current.searches).toEqual(["laptops"]);
  });

  it("returns the same object while nothing changes", () => {
    view(find(1));
    const { result, rerender } = renderHook(() => useRawSignals());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
