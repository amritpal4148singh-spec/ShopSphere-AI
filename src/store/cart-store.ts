import { create } from "zustand";

import { useAnalyticsStore } from "@/store/analytics-store";
import { clearCartSnapshot, loadCartSnapshot, saveCartSnapshot } from "@/lib/cart-storage";
import {
  addToCart,
  confirmPrice as confirmPriceInSnapshot,
  mergeSnapshots,
  moveToCart as moveToCartInSnapshot,
  reconcileSnapshot,
  removeItem as removeItemFromSnapshot,
  removeSavedItem,
  saveForLater as saveForLaterInSnapshot,
  setCoupon,
  setQuantity as setQuantityInSnapshot,
  type AddOutcome,
  type LiveResolver,
  type MoveOutcome,
  type QuantityOutcome,
} from "@/utils/cart";
import type { CartSnapshot, NewCartItem } from "@/types/cart";

/**
 * Cart state (Zustand). One cart per owner: the guest (this device) or a signed-in customer.
 * Every mutation first re-reads the persisted cart, so a second tab's changes are never overwritten with
 * stale data (PRD edge case 26: no duplicated or lost lines). Server/cache data (live prices and stock)
 * lives in TanStack Query, not here.
 */
interface CartState extends CartSnapshot {
  /** "idle" until the owner (guest or user) is known; the UI shows a skeleton meanwhile. */
  status: "idle" | "ready";
  ownerId: string | null;
  /** Transient messages such as "quantity reduced because stock fell". Not persisted. */
  notices: Record<string, string>;
  switchOwner: (ownerId: string | null) => void;
  reload: () => void;
  addItem: (input: NewCartItem) => AddOutcome | { type: "not-ready" };
  setQuantity: (key: string, requested: number, stock?: number) => QuantityOutcome | null;
  removeItem: (key: string) => void;
  /** Empties the active cart and its coupon after an order is placed. Items saved for later are kept. */
  clear: () => void;
  saveForLater: (key: string) => void;
  moveToCart: (key: string, stock?: number) => MoveOutcome | { type: "not-ready" };
  removeSaved: (key: string) => void;
  confirmPrice: (key: string, price: number) => void;
  applyCoupon: (code: string | null) => void;
  reconcile: (resolve: LiveResolver) => void;
  dismissNotice: (key: string) => void;
}

function snapshotOf(state: CartSnapshot): CartSnapshot {
  return { items: state.items, saved: state.saved, couponCode: state.couponCode };
}

export const useCartStore = create<CartState>()((set, get) => {
  /** The latest cart: re-read from storage when ready, so concurrent tabs stay consistent. */
  function fresh(): CartSnapshot {
    const state = get();
    return state.status === "ready" ? loadCartSnapshot(state.ownerId) : snapshotOf(state);
  }

  function commit(snapshot: CartSnapshot): void {
    saveCartSnapshot(get().ownerId, snapshot);
    set({ ...snapshot });
  }

  return {
    status: "idle",
    ownerId: null,
    items: [],
    saved: [],
    couponCode: null,
    notices: {},

    switchOwner: (ownerId) => {
      const { status, ownerId: previous } = get();
      if (status === "ready" && previous === ownerId) return;

      let snapshot = loadCartSnapshot(ownerId);
      // A guest who signs in keeps what they added: merge the guest cart into the account cart.
      if (status === "ready" && previous === null && ownerId !== null) {
        const guest = loadCartSnapshot(null);
        if (guest.items.length > 0 || guest.saved.length > 0) {
          snapshot = mergeSnapshots(snapshot, guest);
          saveCartSnapshot(ownerId, snapshot);
          clearCartSnapshot(null);
        }
      }
      set({ status: "ready", ownerId, ...snapshot, notices: {} });
    },

    reload: () => {
      const { status, ownerId } = get();
      if (status === "ready") set({ ...loadCartSnapshot(ownerId) });
    },

    addItem: (input) => {
      if (get().status !== "ready") return { type: "not-ready" };
      const result = addToCart(fresh(), input);
      if (result.outcome.type !== "out-of-stock") {
        commit(result.snapshot);
        // Local recommendation analytics (PRD 8.4): an add-to-cart can complete a recommendation click.
        useAnalyticsStore.getState().addToCart(input.productId);
      }
      return result.outcome;
    },

    setQuantity: (key, requested, stock) => {
      const snapshot = fresh();
      const line = snapshot.items.find((item) => item.key === key);
      const result = setQuantityInSnapshot(snapshot, key, requested, stock ?? line?.knownStock ?? 0);
      if (result.outcome && result.outcome.limit > 0) commit(result.snapshot);
      return result.outcome;
    },

    removeItem: (key) => {
      commit(removeItemFromSnapshot(fresh(), key));
      const { [key]: _removed, ...rest } = get().notices;
      void _removed;
      set({ notices: rest });
    },

    clear: () => commit({ ...fresh(), items: [], couponCode: null }),

    saveForLater: (key) => commit(saveForLaterInSnapshot(fresh(), key)),

    moveToCart: (key, stock) => {
      if (get().status !== "ready") return { type: "not-ready" };
      const snapshot = fresh();
      const saved = snapshot.saved.find((item) => item.key === key);
      const result = moveToCartInSnapshot(snapshot, key, stock ?? saved?.knownStock ?? 0);
      if (result.outcome.type === "moved" || result.outcome.type === "limited") {
        commit(result.snapshot);
        if (saved) useAnalyticsStore.getState().addToCart(saved.productId);
      }
      return result.outcome;
    },

    removeSaved: (key) => commit(removeSavedItem(fresh(), key)),

    confirmPrice: (key, price) => commit(confirmPriceInSnapshot(fresh(), key, price)),

    applyCoupon: (code) => commit(setCoupon(fresh(), code)),

    reconcile: (resolve) => {
      if (get().status !== "ready") return;
      const result = reconcileSnapshot(fresh(), resolve);
      if (!result.changed) return;
      commit(result.snapshot);
      set({ notices: { ...get().notices, ...result.notices } });
    },

    dismissNotice: (key) => {
      const { [key]: _removed, ...rest } = get().notices;
      void _removed;
      set({ notices: rest });
    },
  };
});
