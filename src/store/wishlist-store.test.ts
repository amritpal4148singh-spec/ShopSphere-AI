import { loadWishlist, wishlistStorageKey } from "@/lib/wishlist-storage";
import type { NewWishlistItem } from "@/types/cart";
import { useWishlistStore } from "./wishlist-store";

const input = (overrides: Partial<NewWishlistItem> = {}): NewWishlistItem => ({
  productId: 1,
  title: "Trail Runner",
  brand: "Nike",
  category: "mens-shoes",
  thumbnail: null,
  price: 3000,
  availability: "in-stock",
  ...overrides,
});

beforeEach(() => {
  useWishlistStore.setState({ status: "idle", ownerId: null, items: [] });
  localStorage.clear();
  sessionStorage.clear();
});

describe("useWishlistStore", () => {
  it("refuses changes until the owner is known", () => {
    expect(useWishlistStore.getState().toggle(input())).toBe("not-ready");
  });

  it("toggles a product on and off", () => {
    useWishlistStore.getState().switchOwner(null);

    expect(useWishlistStore.getState().toggle(input())).toBe("added");
    expect(useWishlistStore.getState().items).toHaveLength(1);

    expect(useWishlistStore.getState().toggle(input())).toBe("removed");
    expect(useWishlistStore.getState().items).toEqual([]);
  });

  it("keeps a guest wishlist in session storage only (PRD 4.3)", () => {
    useWishlistStore.getState().switchOwner(null);
    useWishlistStore.getState().toggle(input());

    expect(sessionStorage.getItem(wishlistStorageKey(null))).not.toBeNull();
    expect(localStorage.getItem(wishlistStorageKey(null))).toBeNull();
  });

  it("persists a signed-in customer's wishlist in local storage", () => {
    useWishlistStore.getState().switchOwner("u1");
    useWishlistStore.getState().toggle(input());

    expect(localStorage.getItem(wishlistStorageKey("u1"))).not.toBeNull();
    expect(sessionStorage.getItem(wishlistStorageKey("u1"))).toBeNull();
  });

  it("merges the guest wishlist into the customer's on sign-in and clears the guest list", () => {
    useWishlistStore.getState().switchOwner(null);
    useWishlistStore.getState().toggle(input({ productId: 1 }));

    useWishlistStore.getState().switchOwner("u1");
    useWishlistStore.getState().toggle(input({ productId: 2 }));

    expect(loadWishlist("u1").map((item) => item.productId).sort()).toEqual([1, 2]);
    expect(loadWishlist(null)).toEqual([]);
  });

  it("removes an item, and reload picks up changes made elsewhere", () => {
    useWishlistStore.getState().switchOwner("u1");
    useWishlistStore.getState().toggle(input({ productId: 1 }));
    useWishlistStore.getState().remove(1);
    expect(useWishlistStore.getState().items).toEqual([]);

    localStorage.setItem(
      wishlistStorageKey("u1"),
      JSON.stringify([{ ...input({ productId: 5 }), savedPrice: 3000, addedAt: 1 }]),
    );
    useWishlistStore.getState().reload();
    expect(useWishlistStore.getState().items.map((item) => item.productId)).toEqual([5]);
  });

  it("reconcile refreshes the last-known price and availability", () => {
    useWishlistStore.getState().switchOwner(null);
    useWishlistStore.getState().toggle(input());

    useWishlistStore.getState().reconcile(() => ({ price: 2500, availability: "out-of-stock" }));

    expect(useWishlistStore.getState().items[0]).toMatchObject({ price: 2500, availability: "out-of-stock", savedPrice: 3000 });
  });
});
