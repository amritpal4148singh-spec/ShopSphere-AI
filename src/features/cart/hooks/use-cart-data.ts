"use client";

import { useEffect, useMemo } from "react";

import { useCatalog } from "@/features/products";
import { getVariantStock } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { buildCartLines, computeTotals, getCheckoutBlockers, getSubtotal, type LiveResolver } from "@/utils/cart";

/**
 * The cart as the shopper sees it: stored lines combined with live prices and stock from the cached catalogue.
 * If the catalogue cannot be loaded, lines fall back to their last-known data (PRD 5.5) and `catalog.isError` is set.
 */
export function useCartData() {
  const status = useCartStore((state) => state.status);
  const items = useCartStore((state) => state.items);
  const saved = useCartStore((state) => state.saved);
  const couponCode = useCartStore((state) => state.couponCode);
  const notices = useCartStore((state) => state.notices);
  const reconcile = useCartStore((state) => state.reconcile);

  const catalog = useCatalog();
  const catalogLoaded = catalog.data !== undefined;

  const resolver = useMemo<LiveResolver | null>(() => {
    if (!catalog.data) return null;
    const byId = new Map(catalog.data.map((product) => [product.id, product]));
    return (item) => {
      const product = byId.get(item.productId);
      return product ? { stock: getVariantStock(product, item.variantId), price: product.finalPrice } : null;
    };
  }, [catalog.data]);

  // Keep last-known stock fresh and reduce quantities that exceed it. Commits only when something changed.
  useEffect(() => {
    if (resolver) reconcile(resolver);
  }, [resolver, items, saved, reconcile]);

  const lines = useMemo(() => buildCartLines(items, resolver, catalogLoaded), [items, resolver, catalogLoaded]);
  const savedLines = useMemo(() => buildCartLines(saved, resolver, catalogLoaded), [saved, resolver, catalogLoaded]);
  const totals = useMemo(() => computeTotals(getSubtotal(lines), couponCode), [lines, couponCode]);
  const blockers = useMemo(() => getCheckoutBlockers(lines), [lines]);

  return { status, lines, savedLines, totals, blockers, couponCode, notices, catalog, catalogLoaded };
}
