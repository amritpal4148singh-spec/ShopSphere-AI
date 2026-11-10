import { MAX_VIEWED } from "@/services/recommendations/constants";
import { VIEWED_STORAGE_KEY, loadViewed, saveViewed } from "@/lib/viewed-storage";
import { useViewedStore } from "./viewed-store";

const product = (productId: number) => ({ productId, category: "mens-shoes", brand: "Nike", price: 3000, tags: ["running"] });

beforeEach(() => {
  localStorage.clear();
  useViewedStore.setState({ status: "idle", items: [] });
});

describe("useViewedStore", () => {
  it("is idle until hydrated, then loads what was stored", () => {
    saveViewed([{ ...product(1), viewedAt: 5 }]);
    expect(useViewedStore.getState().status).toBe("idle");

    useViewedStore.getState().hydrate();

    expect(useViewedStore.getState().status).toBe("ready");
    expect(useViewedStore.getState().items.map((item) => item.productId)).toEqual([1]);
  });

  it("records views with the most recent first and saves them", () => {
    useViewedStore.getState().record(product(1));
    useViewedStore.getState().record(product(2));

    expect(useViewedStore.getState().items.map((item) => item.productId)).toEqual([2, 1]);
    expect(loadViewed().map((item) => item.productId)).toEqual([2, 1]);
  });

  it("moves a product viewed again to the front instead of repeating it", () => {
    useViewedStore.getState().record(product(1));
    useViewedStore.getState().record(product(2));
    useViewedStore.getState().record(product(1));

    expect(useViewedStore.getState().items.map((item) => item.productId)).toEqual([1, 2]);
  });

  it("keeps only the most recent views", () => {
    for (let id = 1; id <= MAX_VIEWED + 4; id++) useViewedStore.getState().record(product(id));

    const items = useViewedStore.getState().items;
    expect(items).toHaveLength(MAX_VIEWED);
    expect(items[0]?.productId).toBe(MAX_VIEWED + 4);
  });

  it("keeps a view recorded in another tab when recording here", () => {
    useViewedStore.getState().hydrate();
    saveViewed([{ ...product(99), viewedAt: Date.now() - 1000 }]);

    useViewedStore.getState().record(product(1));

    expect(useViewedStore.getState().items.map((item) => item.productId).sort((a, b) => a - b)).toEqual([1, 99]);
  });

  it("works before hydration (a view is never lost)", () => {
    useViewedStore.getState().record(product(7));
    expect(useViewedStore.getState().status).toBe("ready");
    expect(loadViewed()).toHaveLength(1);
  });

  it("clears the history, including what is stored", () => {
    useViewedStore.getState().record(product(1));
    useViewedStore.getState().clear();

    expect(useViewedStore.getState().items).toEqual([]);
    expect(localStorage.getItem(VIEWED_STORAGE_KEY)).toBeNull();
  });
});
