import { create } from "zustand";

import { clearAnalytics, loadAnalytics, saveAnalytics } from "@/lib/analytics-storage";
import { emptyAnalytics, recordAddToCart, recordClick, recordImpressions, recordProductView } from "@/utils/analytics";
import type { StrategyId } from "@/services/recommendations";
import type { AnalyticsData } from "@/types/analytics";

/**
 * Local recommendation analytics (PRD 8.4). Events are written straight to storage (after re-reading it, so two tabs
 * never overwrite each other), which means recording works before `hydrate` and from non-React code such as the cart.
 */
interface AnalyticsState extends AnalyticsData {
  status: "idle" | "ready";
  hydrate: () => void;
  reload: () => void;
  impressions: (strategy: StrategyId, count: number) => void;
  click: (strategy: StrategyId, productId: number) => void;
  addToCart: (productId: number) => void;
  productView: () => void;
  /** Administrator action: forget everything tracked on this device. */
  reset: () => void;
}

function dataOf(state: AnalyticsData): AnalyticsData {
  return { since: state.since, counts: state.counts, pending: state.pending, productViews: state.productViews };
}

export const useAnalyticsStore = create<AnalyticsState>()((set) => {
  function update(change: (data: AnalyticsData) => AnalyticsData): void {
    const current = loadAnalytics();
    const next = change(current);
    if (next === current) return;
    saveAnalytics(next);
    set({ ...next });
  }

  return {
    status: "idle",
    ...emptyAnalytics(0),

    hydrate: () => set({ status: "ready", ...loadAnalytics() }),
    reload: () => set({ status: "ready", ...loadAnalytics() }),
    impressions: (strategy, count) => update((data) => recordImpressions(data, strategy, count)),
    click: (strategy, productId) => update((data) => recordClick(data, strategy, productId, Date.now())),
    addToCart: (productId) => update((data) => recordAddToCart(data, productId, Date.now())),
    productView: () => update(recordProductView),
    reset: () => {
      clearAnalytics();
      set({ status: "ready", ...dataOf(emptyAnalytics(Date.now())) });
    },
  };
});
