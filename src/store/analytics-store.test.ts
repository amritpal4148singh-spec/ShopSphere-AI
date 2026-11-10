import { loadAnalytics } from "@/lib/analytics-storage";
import { makeProduct } from "@/test/fixtures";
import { putInCart } from "@/test/recommendations";
import { useCartStore } from "./cart-store";
import { useAnalyticsStore } from "./analytics-store";

beforeEach(() => {
  localStorage.clear();
  useAnalyticsStore.setState({ status: "idle", since: 0, counts: {}, pending: [], productViews: 0 });
  useCartStore.setState({ status: "idle", ownerId: null, items: [], saved: [], couponCode: null, notices: {} });
  useCartStore.getState().switchOwner(null);
});

describe("useAnalyticsStore", () => {
  it("records events into storage and state, even before hydrate (non-React callers)", () => {
    const store = useAnalyticsStore.getState();
    store.impressions("similar", 4);
    store.click("similar", 9);
    store.productView();
    const stored = loadAnalytics();
    expect(stored.counts.similar).toEqual({ impressions: 4, clicks: 1, conversions: 0 });
    expect(stored.productViews).toBe(1);
    expect(useAnalyticsStore.getState().counts.similar?.clicks).toBe(1);
  });

  it("re-reads storage before writing, so two tabs add up", () => {
    useAnalyticsStore.getState().hydrate();
    useAnalyticsStore.getState().impressions("similar", 2);
    localStorage.setItem("shopsphere.analytics.v1", JSON.stringify({ ...loadAnalytics(), counts: { similar: { impressions: 10, clicks: 0, conversions: 0 } } }));
    useAnalyticsStore.getState().impressions("similar", 1);
    expect(loadAnalytics().counts.similar?.impressions).toBe(11);
  });

  it("resets everything tracked", () => {
    useAnalyticsStore.getState().impressions("trending", 3);
    useAnalyticsStore.getState().reset();
    expect(useAnalyticsStore.getState()).toMatchObject({ status: "ready", counts: {}, pending: [], productViews: 0 });
    expect(loadAnalytics().counts).toEqual({});
  });

  it("does not write when an add-to-cart matches no recommendation click", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    useAnalyticsStore.getState().addToCart(5);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("counts a conversion when a clicked recommendation is added to the cart through the cart store", () => {
    useAnalyticsStore.getState().click("cart-based", 3);
    putInCart(makeProduct({ id: 3 }));
    expect(loadAnalytics().counts["cart-based"]).toEqual({ impressions: 0, clicks: 1, conversions: 1 });
    // A product nobody clicked adds nothing.
    putInCart(makeProduct({ id: 4 }));
    expect(loadAnalytics().counts["cart-based"]?.conversions).toBe(1);
  });

  it("counts a conversion when a saved-for-later item is moved to the cart", () => {
    const product = makeProduct({ id: 3 });
    putInCart(product);
    const line = useCartStore.getState().items[0]!;
    useCartStore.getState().saveForLater(line.key);
    useAnalyticsStore.getState().click("wishlist-based", 3);
    useCartStore.getState().moveToCart(useCartStore.getState().saved[0]!.key, 10);
    expect(loadAnalytics().counts["wishlist-based"]?.conversions).toBe(1);
  });
});
