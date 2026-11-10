import { COMPARE_STORAGE_KEY } from "@/lib/compare-storage";
import type { CompareItem } from "@/utils/compare";
import { useCompareStore } from "./compare-store";

const item = (n: number): CompareItem => ({ productId: n, title: `P${n}`, thumbnail: "t", category: "c" });
beforeEach(() => {
  sessionStorage.clear();
  useCompareStore.setState({ status: "idle", items: [], lastOutcome: null });
  useCompareStore.getState().hydrate();
});

describe("compare store", () => {
  it("adds, persists for the session, and restores after a reload", () => {
    useCompareStore.getState().add(item(1));
    useCompareStore.getState().add(item(2));
    expect(JSON.parse(sessionStorage.getItem(COMPARE_STORAGE_KEY)!)).toHaveLength(2);

    useCompareStore.setState({ status: "idle", items: [] });
    useCompareStore.getState().hydrate();
    expect(useCompareStore.getState().items.map((i) => i.productId)).toEqual([1, 2]);
  });

  it("refuses duplicates and a fifth product, and says why", () => {
    for (const n of [1, 2, 3, 4]) useCompareStore.getState().add(item(n));
    expect(useCompareStore.getState().add(item(4))).toBe("duplicate");
    expect(useCompareStore.getState().add(item(5))).toBe("full");
    expect(useCompareStore.getState().lastOutcome).toBe("full");
    expect(useCompareStore.getState().items).toHaveLength(4);
  });

  it("removes one product and clears all", () => {
    useCompareStore.getState().add(item(1));
    useCompareStore.getState().add(item(2));
    useCompareStore.getState().remove(1);
    expect(useCompareStore.getState().items.map((i) => i.productId)).toEqual([2]);
    useCompareStore.getState().clear();
    expect(useCompareStore.getState().items).toEqual([]);
    expect(sessionStorage.getItem(COMPARE_STORAGE_KEY)).toBeNull();
  });

  it("does not lose a product added by another tab", () => {
    useCompareStore.getState().add(item(1));
    sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify([item(1), item(9)]));
    useCompareStore.getState().add(item(2));
    expect(useCompareStore.getState().items.map((i) => i.productId)).toEqual([1, 9, 2]);
  });

  it("ignores corrupt storage and duplicate entries", () => {
    sessionStorage.setItem(COMPARE_STORAGE_KEY, "oops");
    useCompareStore.getState().hydrate();
    expect(useCompareStore.getState().items).toEqual([]);
    sessionStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify([item(1), item(1), { nope: true }]));
    useCompareStore.getState().hydrate();
    expect(useCompareStore.getState().items).toHaveLength(1);
  });
});
