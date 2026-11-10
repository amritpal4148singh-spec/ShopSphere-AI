"use client";

import { useMemo, useSyncExternalStore } from "react";

import { getSearchHistorySnapshot, parseSearchHistory, subscribeSearchHistory } from "@/lib/search-history";
import { EMPTY_RAW_SIGNALS, type RawSignals } from "@/services/recommendations";
import { useCartStore } from "@/store/cart-store";
import { useOrdersStore } from "@/store/orders-store";
import { useViewedStore } from "@/store/viewed-store";
import { useWishlistStore } from "@/store/wishlist-store";

/**
 * Everything the shopper has done on this device, as plain data for the recommendation service: views, searches,
 * wishlist, cart and orders (PRD 6.1). All of it is local; nothing leaves the browser.
 */
export function useRawSignals(): RawSignals {
  const viewed = useViewedStore((state) => state.items);
  const cart = useCartStore((state) => state.items);
  const wishlist = useWishlistStore((state) => state.items);
  const orders = useOrdersStore((state) => state.orders);
  const searchSnapshot = useSyncExternalStore(subscribeSearchHistory, getSearchHistorySnapshot, () => "");

  return useMemo(() => {
    if (!viewed.length && !cart.length && !wishlist.length && !orders.length && !searchSnapshot) return EMPTY_RAW_SIGNALS;
    return {
      viewed,
      searches: parseSearchHistory(searchSnapshot),
      wishlist: wishlist.map((item) => ({ productId: item.productId, category: item.category, brand: item.brand, price: item.price })),
      cart: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, category: item.category, price: item.unitPrice })),
      orders: orders.map((order) => ({
        placedAt: order.placedAt,
        items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice })),
      })),
    };
  }, [viewed, cart, wishlist, orders, searchSnapshot]);
}
