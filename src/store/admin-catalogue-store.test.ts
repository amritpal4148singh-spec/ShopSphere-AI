import { ADMIN_CATALOGUE_KEY, loadOverlay } from "@/lib/admin-storage";
import { EMPTY_OVERLAY, LOCAL_ID_START } from "@/utils/admin-catalogue";
import { useAdminCatalogueStore } from "./admin-catalogue-store";

const values = { title: "Gadget", brand: null, category: "laptops", price: 100, discountPercentage: 0, stock: 3, description: "", tags: [] };

beforeEach(() => {
  localStorage.clear();
  useAdminCatalogueStore.setState({ status: "idle", overlay: EMPTY_OVERLAY, saveFailed: false });
  useAdminCatalogueStore.getState().hydrate();
});

describe("useAdminCatalogueStore", () => {
  it("creates a local product and persists it", () => {
    const id = useAdminCatalogueStore.getState().create(values);
    expect(id).toBe(LOCAL_ID_START);
    expect(loadOverlay().added.map((product) => product.id)).toEqual([id]);
    expect(useAdminCatalogueStore.getState().create(values)).toBe(id + 1);
  });

  it("saves and discards edits of a catalogue product", () => {
    useAdminCatalogueStore.getState().save({ id: 5, origin: "catalogue" }, values);
    expect(loadOverlay().edits[5]).toEqual(values);
    useAdminCatalogueStore.getState().revert(5);
    expect(loadOverlay().edits).toEqual({});
  });

  it("archives a referenced product, removes an unreferenced one, and restores both", () => {
    const store = useAdminCatalogueStore.getState();
    expect(store.remove({ id: 1, origin: "catalogue" }, new Set([1]))).toBe("archived");
    expect(store.remove({ id: 2, origin: "catalogue" }, new Set([1]))).toBe("removed");
    expect(loadOverlay()).toMatchObject({ archived: [1], removed: [2] });
    store.restore(1);
    store.restore(2);
    expect(loadOverlay()).toMatchObject({ archived: [], removed: [] });
  });

  it("adds and renames categories, returning the validation error without saving", () => {
    const rows = [{ slug: "laptops", name: "Laptops", renamed: false, local: false, productCount: 1 }];
    expect(useAdminCatalogueStore.getState().addCategory("Garden", rows)).toMatchObject({ ok: true });
    expect(useAdminCatalogueStore.getState().addCategory("laptops", rows)).toMatchObject({ ok: false });
    expect(useAdminCatalogueStore.getState().renameCategory("laptops", "Notebooks", rows)).toMatchObject({ ok: true });
    expect(loadOverlay().addedCategories).toEqual([{ slug: "garden", name: "Garden" }]);
    expect(loadOverlay().renamedCategories).toEqual({ laptops: "Notebooks" });
  });

  it("re-reads storage before writing so another tab's change survives", () => {
    useAdminCatalogueStore.getState().create(values);
    const stored = loadOverlay();
    localStorage.setItem(ADMIN_CATALOGUE_KEY, JSON.stringify({ ...stored, removed: [99] }));
    useAdminCatalogueStore.getState().save({ id: 5, origin: "catalogue" }, values);
    expect(loadOverlay().removed).toEqual([99]);
  });

  it("only follows other tabs once hydrated, and flags a refused write", () => {
    useAdminCatalogueStore.setState({ status: "idle" });
    localStorage.setItem(ADMIN_CATALOGUE_KEY, JSON.stringify({ ...EMPTY_OVERLAY, removed: [7] }));
    useAdminCatalogueStore.getState().reload();
    expect(useAdminCatalogueStore.getState().overlay.removed).toEqual([]);
    useAdminCatalogueStore.getState().hydrate();
    expect(useAdminCatalogueStore.getState().overlay.removed).toEqual([7]);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    useAdminCatalogueStore.getState().create(values);
    expect(useAdminCatalogueStore.getState().saveFailed).toBe(true);
    spy.mockRestore();
  });
});
