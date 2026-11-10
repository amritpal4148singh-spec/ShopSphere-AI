import { create } from "zustand";

import { loadCompare, saveCompare } from "@/lib/compare-storage";
import { addCompareItem, removeCompareItem, toggleCompareItem, type CompareItem, type CompareResult } from "@/utils/compare";

/**
 * Products selected for side-by-side comparison (PRD 5.2): 2 to 4, no duplicates, kept for the browser session.
 * Every change re-reads storage first, so two tabs sharing a session never overwrite each other.
 */
interface CompareState {
  status: "idle" | "ready";
  items: CompareItem[];
  /** The outcome of the last add/toggle, so the UI can explain a refusal ("full"). Cleared by the next change. */
  lastOutcome: CompareResult["outcome"] | null;
  hydrate: () => void;
  reload: () => void;
  add: (item: CompareItem) => CompareResult["outcome"];
  remove: (productId: number) => void;
  toggle: (item: CompareItem) => CompareResult["outcome"];
  clear: () => void;
}

export const useCompareStore = create<CompareState>()((set, get) => {
  const fresh = (): CompareItem[] => (get().status === "ready" ? loadCompare() : get().items);
  const commit = (result: CompareResult): CompareResult["outcome"] => {
    if (result.outcome === "added" || result.outcome === "removed") saveCompare(result.items);
    set({ items: result.items, lastOutcome: result.outcome });
    return result.outcome;
  };

  return {
    status: "idle",
    items: [],
    lastOutcome: null,
    hydrate: () => set({ status: "ready", items: loadCompare() }),
    reload: () => {
      if (get().status === "ready") set({ items: loadCompare() });
    },
    add: (item) => commit(addCompareItem(fresh(), item)),
    remove: (productId) => void commit(removeCompareItem(fresh(), productId)),
    toggle: (item) => commit(toggleCompareItem(fresh(), item)),
    clear: () => {
      saveCompare([]);
      set({ items: [], lastOutcome: null });
    },
  };
});
