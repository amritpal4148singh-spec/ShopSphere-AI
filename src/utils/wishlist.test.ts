import type { NewWishlistItem, WishlistItem } from "@/types/cart";
import { buildWishlistLines, mergeWishlists, reconcileWishlist, removeWishlistItem, toggleWishlist } from "./wishlist";

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

const item = (overrides: Partial<WishlistItem> = {}): WishlistItem => ({
  ...input(),
  savedPrice: 3000,
  addedAt: 1,
  ...overrides,
});

describe("toggleWishlist", () => {
  it("adds a product, remembering the price it was saved at", () => {
    const { items, added } = toggleWishlist([], input(), 7);
    expect(added).toBe(true);
    expect(items).toEqual([item({ addedAt: 7 })]);
  });

  it("removes a product that is already saved", () => {
    const { items, added } = toggleWishlist([item()], input());
    expect(added).toBe(false);
    expect(items).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const original = [item()];
    toggleWishlist(original, input({ productId: 2 }));
    expect(original).toHaveLength(1);
  });
});

describe("removeWishlistItem and mergeWishlists", () => {
  it("removes by product id", () => {
    expect(removeWishlistItem([item(), item({ productId: 2 })], 1).map((entry) => entry.productId)).toEqual([2]);
  });

  it("merges by product id, keeping the base entry on conflict", () => {
    const merged = mergeWishlists([item({ price: 111 })], [item({ price: 222 }), item({ productId: 2 })]);
    expect(merged.map((entry) => [entry.productId, entry.price])).toEqual([
      [1, 111],
      [2, 3000],
    ]);
  });
});

describe("reconcileWishlist", () => {
  it("refreshes the last-known price and availability", () => {
    const result = reconcileWishlist([item()], () => ({ price: 2500, availability: "out-of-stock" }));
    expect(result.changed).toBe(true);
    expect(result.items[0]).toMatchObject({ price: 2500, availability: "out-of-stock", savedPrice: 3000 });
  });

  it("returns the same list when nothing changed or the product is unknown", () => {
    const list = [item()];
    expect(reconcileWishlist(list, () => ({ price: 3000, availability: "in-stock" })).items).toBe(list);
    expect(reconcileWishlist(list, () => null).changed).toBe(false);
  });
});

describe("buildWishlistLines (PRD 5.9)", () => {
  it("shows the current price and stock status", () => {
    const [built] = buildWishlistLines([item()], () => ({ price: 2800, availability: "low-stock" }), true);
    expect(built).toMatchObject({ availability: "low-stock", price: 2800, priceChange: { from: 3000, to: 2800 }, stale: false });
  });

  it("marks an out-of-stock item without removing it (MOD-09-001)", () => {
    const lines = buildWishlistLines([item()], () => ({ price: 3000, availability: "out-of-stock" }), true);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.availability).toBe("out-of-stock");
  });

  it("marks a product the API no longer returns as unavailable", () => {
    const [built] = buildWishlistLines([item()], () => null, true);
    expect(built?.availability).toBe("unavailable");
  });

  it("falls back to last-known data, marked stale, when live data is unavailable", () => {
    const [built] = buildWishlistLines([item({ price: 2900, availability: "low-stock" })], null, false);
    expect(built).toMatchObject({ availability: "low-stock", price: 2900, stale: true });
  });

  it("reports no price change when the price is unchanged", () => {
    const [built] = buildWishlistLines([item()], () => ({ price: 3000, availability: "in-stock" }), true);
    expect(built?.priceChange).toBeNull();
  });
});
