import { useEffect, useMemo } from "react";

import { useCatalog } from "@/features/products";
import { useWishlistStore } from "@/store/wishlist-store";
import { buildWishlistLines, type WishlistResolver } from "@/utils/wishlist";

/** Wishlist items with live price and stock status (PRD 5.9), or last-known data when the API is unavailable. */
export function useWishlistData() {
  const status = useWishlistStore((state) => state.status);
  const ownerId = useWishlistStore((state) => state.ownerId);
  const items = useWishlistStore((state) => state.items);
  const reconcile = useWishlistStore((state) => state.reconcile);

  const catalog = useCatalog();
  const catalogLoaded = catalog.data !== undefined;

  const byId = useMemo(() => new Map((catalog.data ?? []).map((product) => [product.id, product])), [catalog.data]);

  const resolver = useMemo<WishlistResolver | null>(() => {
    if (!catalog.data) return null;
    return (productId) => {
      const product = byId.get(productId);
      return product ? { price: product.finalPrice, availability: product.availability } : null;
    };
  }, [catalog.data, byId]);

  useEffect(() => {
    if (resolver) reconcile(resolver);
  }, [resolver, items, reconcile]);

  const lines = useMemo(() => buildWishlistLines(items, resolver, catalogLoaded), [items, resolver, catalogLoaded]);

  return { status, ownerId, lines, catalog, catalogLoaded, products: byId };
}
