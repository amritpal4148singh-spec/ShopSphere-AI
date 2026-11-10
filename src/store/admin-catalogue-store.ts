import { create } from "zustand";

import { loadOverlay, saveOverlay } from "@/lib/admin-storage";
import {
  EMPTY_OVERLAY,
  addCategory,
  createLocalProduct,
  removeProduct,
  renameCategory,
  restoreProduct,
  revertProduct,
  saveProductValues,
  type CategoryResult,
  type RemoveOutcome,
} from "@/utils/admin-catalogue";
import type { AdminProduct, CatalogueOverlay, CategoryRow, ProductValues } from "@/types/admin";

/**
 * The administrator's simulated catalogue changes (PRD 4.2, 8.2): edits, new and removed products, archived products
 * and category changes. Persisted in this browser only. Every change re-reads storage first (two tabs stay consistent).
 */
interface AdminCatalogueState {
  status: "idle" | "ready";
  overlay: CatalogueOverlay;
  saveFailed: boolean;
  hydrate: () => void;
  reload: () => void;
  create: (values: ProductValues) => number;
  save: (product: Pick<AdminProduct, "id" | "origin">, values: ProductValues) => void;
  revert: (id: number) => void;
  remove: (product: Pick<AdminProduct, "id" | "origin">, referenced: ReadonlySet<number>) => RemoveOutcome;
  restore: (id: number) => void;
  addCategory: (name: string, rows: readonly CategoryRow[]) => CategoryResult;
  renameCategory: (slug: string, name: string, rows: readonly CategoryRow[]) => CategoryResult;
}

export const useAdminCatalogueStore = create<AdminCatalogueState>()((set, get) => {
  const fresh = (): CatalogueOverlay => (get().status === "ready" ? loadOverlay() : get().overlay);

  function commit(overlay: CatalogueOverlay): void {
    set({ overlay, saveFailed: !saveOverlay(overlay) });
  }

  function commitResult(result: CategoryResult): CategoryResult {
    if (result.ok) commit(result.overlay);
    return result;
  }

  return {
    status: "idle",
    overlay: EMPTY_OVERLAY,
    saveFailed: false,

    hydrate: () => set({ status: "ready", overlay: loadOverlay(), saveFailed: false }),
    reload: () => {
      if (get().status === "ready") set({ overlay: loadOverlay() });
    },

    create: (values) => {
      const result = createLocalProduct(fresh(), values, Date.now());
      commit(result.overlay);
      return result.id;
    },
    save: (product, values) => commit(saveProductValues(fresh(), product, values)),
    revert: (id) => commit(revertProduct(fresh(), id)),
    remove: (product, referenced) => {
      const result = removeProduct(fresh(), product, referenced);
      commit(result.overlay);
      return result.outcome;
    },
    restore: (id) => commit(restoreProduct(fresh(), id)),
    addCategory: (name, rows) => commitResult(addCategory(fresh(), name, rows)),
    renameCategory: (slug, name, rows) => commitResult(renameCategory(fresh(), slug, name, rows)),
  };
});
