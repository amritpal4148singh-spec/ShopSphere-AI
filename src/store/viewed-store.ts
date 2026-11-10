import { create } from "zustand";

import { clearViewed, loadViewed, saveViewed } from "@/lib/viewed-storage";
import { MAX_VIEWED } from "@/services/recommendations/constants";
import type { ViewedSignal } from "@/services/recommendations";

/**
 * Products the shopper viewed on this device, most recent first (a signal for Recently Viewed and personalization).
 * Every change re-reads storage first, so two tabs never overwrite each other's views.
 */
interface ViewedState {
  status: "idle" | "ready";
  items: ViewedSignal[];
  hydrate: () => void;
  /** Records a view, moving the product to the front. The time is set here. */
  record: (entry: Omit<ViewedSignal, "viewedAt">) => void;
  clear: () => void;
}

export const useViewedStore = create<ViewedState>()((set) => ({
  status: "idle",
  items: [],

  hydrate: () => set({ status: "ready", items: loadViewed() }),

  record: (entry) => {
    const latest = loadViewed().filter((item) => item.productId !== entry.productId);
    const next = [{ ...entry, viewedAt: Date.now() }, ...latest].slice(0, MAX_VIEWED);
    saveViewed(next);
    set({ status: "ready", items: next });
  },

  clear: () => {
    clearViewed();
    set({ status: "ready", items: [] });
  },
}));
