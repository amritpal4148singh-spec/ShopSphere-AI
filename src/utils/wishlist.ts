import type { NewWishlistItem, WishlistItem, WishlistLine } from "@/types/cart";
import type { Availability } from "@/types/product";

/** Adds the product if absent, removes it if present. */
export function toggleWishlist(
  items: readonly WishlistItem[],
  input: NewWishlistItem,
  now: number = Date.now(),
): { items: WishlistItem[]; added: boolean } {
  if (items.some((item) => item.productId === input.productId)) {
    return { items: items.filter((item) => item.productId !== input.productId), added: false };
  }
  const item: WishlistItem = { ...input, savedPrice: input.savedPrice ?? input.price, addedAt: now };
  return { items: [...items, item], added: true };
}

export function removeWishlistItem(items: readonly WishlistItem[], productId: number): WishlistItem[] {
  return items.filter((item) => item.productId !== productId);
}

/** Union by product id; the base list wins on conflicts. Used when a guest signs in (PRD 4.3). */
export function mergeWishlists(base: readonly WishlistItem[], incoming: readonly WishlistItem[]): WishlistItem[] {
  const ids = new Set(base.map((item) => item.productId));
  return [...base, ...incoming.filter((item) => !ids.has(item.productId))];
}

export interface LiveWishlistData {
  price: number;
  availability: Availability;
}

/** Returns null when the product is no longer returned by the API. */
export type WishlistResolver = (productId: number) => LiveWishlistData | null;

/** Refreshes the last-known price and availability so the offline fallback stays as fresh as possible. */
export function reconcileWishlist(items: readonly WishlistItem[], resolve: WishlistResolver): { items: WishlistItem[]; changed: boolean } {
  let changed = false;
  const next = items.map((item) => {
    const live = resolve(item.productId);
    if (!live || (live.price === item.price && live.availability === item.availability)) return item;
    changed = true;
    return { ...item, price: live.price, availability: live.availability };
  });
  return { items: changed ? next : (items as WishlistItem[]), changed };
}

/** Shows current price and stock status per item (PRD 5.9), or last-known data when live data is unavailable. */
export function buildWishlistLines(items: readonly WishlistItem[], resolve: WishlistResolver | null, catalogLoaded: boolean): WishlistLine[] {
  return items.map((item) => {
    const live = catalogLoaded && resolve ? resolve(item.productId) : null;
    if (catalogLoaded && !live) {
      return { item, availability: "unavailable", price: item.price, priceChange: null, stale: false };
    }
    const price = live ? live.price : item.price;
    return {
      item,
      availability: live ? live.availability : item.availability,
      price,
      priceChange: price !== item.savedPrice ? { from: item.savedPrice, to: price } : null,
      stale: !catalogLoaded,
    };
  });
}
