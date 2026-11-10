import { create } from "zustand";

import { clearWishlist, loadWishlist, saveWishlist } from "@/lib/wishlist-storage";
import { mergeWishlists, reconcileWishlist, removeWishlistItem, toggleWishlist, type WishlistResolver } from "@/utils/wishlist";
import type { NewWishlistItem, WishlistItem } from "@/types/cart";

/**
 * Wishlist state (Zustand). A guest's wishlist lives in session storage only; a signed-in customer's is
 * persisted (PRD 4.3). Signing in merges the guest wishlist into the customer's.
 */
interface WishlistState {
  status: "idle" | "ready";
  ownerId: string | null;
  items: WishlistItem[];
  switchOwner: (ownerId: string | null) => void;
  reload: () => void;
  toggle: (input: NewWishlistItem) => "added" | "removed" | "not-ready";
  remove: (productId: number) => void;
  reconcile: (resolve: WishlistResolver) => void;
}

export const useWishlistStore = create<WishlistState>()((set, get) => {
  function fresh(): WishlistItem[] {
    const { status, ownerId, items } = get();
    return status === "ready" ? loadWishlist(ownerId) : items;
  }

  function commit(items: WishlistItem[]): void {
    saveWishlist(get().ownerId, items);
    set({ items });
  }

  return {
    status: "idle",
    ownerId: null,
    items: [],

    switchOwner: (ownerId) => {
      const { status, ownerId: previous } = get();
      if (status === "ready" && previous === ownerId) return;

      let items = loadWishlist(ownerId);
      if (status === "ready" && previous === null && ownerId !== null) {
        const guest = loadWishlist(null);
        if (guest.length > 0) {
          items = mergeWishlists(items, guest);
          saveWishlist(ownerId, items);
          clearWishlist(null);
        }
      }
      set({ status: "ready", ownerId, items });
    },

    reload: () => {
      const { status, ownerId } = get();
      if (status === "ready") set({ items: loadWishlist(ownerId) });
    },

    toggle: (input) => {
      if (get().status !== "ready") return "not-ready";
      const result = toggleWishlist(fresh(), input);
      commit(result.items);
      return result.added ? "added" : "removed";
    },

    remove: (productId) => commit(removeWishlistItem(fresh(), productId)),

    reconcile: (resolve) => {
      if (get().status !== "ready") return;
      const result = reconcileWishlist(fresh(), resolve);
      if (result.changed) commit(result.items);
    },
  };
});
