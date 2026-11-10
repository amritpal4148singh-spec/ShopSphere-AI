import {
  ENTITY_WEIGHTS,
  EVIDENCE_POINTS,
  FULL_CONFIDENCE_EVIDENCE,
  MAX_SEARCHES_COUNTED,
  RECENCY_DECAY,
} from "./constants";
import type { PriceBand, RawSignals, ShopperSignals } from "./types";
import type { Product } from "@/types/product";

interface Entity {
  category: string;
  brand: string | null;
  tags: readonly string[];
  weight: number;
}

function normalize(totals: Map<string, number>): Record<string, number> {
  const max = Math.max(0, ...totals.values());
  const result: Record<string, number> = {};
  if (max === 0) return result;
  for (const [key, value] of totals) result[key] = value / max;
  return result;
}

function add(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

/** The categories a search text points to: category names containing a word of it, or products carrying that tag. */
function categoriesForSearch(text: string, catalog: readonly Product[]): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
  const found = new Set<string>();
  for (const word of words) {
    for (const product of catalog) {
      if (found.has(product.category)) continue;
      const categoryText = product.category.replace(/-/g, " ");
      if (categoryText.includes(word) || product.tags.some((tag) => tag.toLowerCase() === word)) found.add(product.category);
    }
  }
  return [...found];
}

function roundDown(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function roundUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/** The shopper's typical price range (PRD 6.1 / dashboard example): the middle 60% of the prices they engaged with, widened a little. */
export function derivePriceBand(prices: readonly number[]): PriceBand | null {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  let low = sorted[0] as number;
  let high = sorted[sorted.length - 1] as number;

  if (sorted.length >= 3) {
    low = sorted[Math.floor((sorted.length - 1) * 0.2)] as number;
    high = sorted[Math.ceil((sorted.length - 1) * 0.8)] as number;
    low *= 0.85;
    high *= 1.15;
  } else {
    low *= 0.7;
    high *= 1.3;
  }
  return { min: Math.max(0, roundDown(low, 100)), max: roundUp(high, 100) };
}

/**
 * Turns raw local activity into the derived signals the engine scores with. Pure: the same input always gives the
 * same output. Behaviour counts by kind (see ENTITY_WEIGHTS); recent views count more than old ones.
 */
export function assembleSignals(raw: RawSignals, catalog: readonly Product[]): ShopperSignals {
  const byId = new Map(catalog.map((product) => [product.id, product]));

  const viewedSorted = [...raw.viewed].sort((a, b) => b.viewedAt - a.viewedAt);
  const seenViewed = new Set<number>();
  const viewedUnique = viewedSorted.filter((entry) => !seenViewed.has(entry.productId) && seenViewed.add(entry.productId));

  const viewedProducts = viewedUnique.map((entry) => byId.get(entry.productId)).filter((product): product is Product => product !== undefined);
  const wishlistProducts = raw.wishlist.map((entry) => byId.get(entry.productId)).filter((product): product is Product => product !== undefined);
  const cartProducts = raw.cart.map((entry) => byId.get(entry.productId)).filter((product): product is Product => product !== undefined);

  const purchasedIds: number[] = [];
  const coPurchases = new Map<number, Set<number>>();
  for (const order of raw.orders) {
    const ids = [...new Set(order.items.map((item) => item.productId))];
    for (const id of ids) {
      if (!purchasedIds.includes(id)) purchasedIds.push(id);
      const others = coPurchases.get(id) ?? new Set<number>();
      for (const other of ids) if (other !== id) others.add(other);
      coPurchases.set(id, others);
    }
  }
  const purchasedProducts = purchasedIds.map((id) => byId.get(id)).filter((product): product is Product => product !== undefined);

  // Behaviour as weighted entities. A view falls back to the snapshot saved at the time if the product left the catalogue.
  const entities: Entity[] = [];
  viewedUnique.forEach((entry, rank) => {
    const product = byId.get(entry.productId);
    entities.push({
      category: product?.category ?? entry.category,
      brand: product ? product.brand : entry.brand,
      tags: product?.tags ?? entry.tags,
      weight: ENTITY_WEIGHTS.viewed * RECENCY_DECAY ** rank,
    });
  });
  for (const entry of raw.wishlist) {
    const product = byId.get(entry.productId);
    entities.push({ category: product?.category ?? entry.category, brand: product ? product.brand : entry.brand, tags: product?.tags ?? [], weight: ENTITY_WEIGHTS.wishlist });
  }
  for (const entry of raw.cart) {
    const product = byId.get(entry.productId);
    entities.push({ category: product?.category ?? entry.category, brand: product?.brand ?? null, tags: product?.tags ?? [], weight: ENTITY_WEIGHTS.cart });
  }
  for (const product of purchasedProducts) {
    entities.push({ category: product.category, brand: product.brand, tags: product.tags, weight: ENTITY_WEIGHTS.purchase });
  }

  const categoryTotals = new Map<string, number>();
  const tagTotals = new Map<string, number>();
  const brandTotals = new Map<string, number>();
  for (const entity of entities) {
    add(categoryTotals, entity.category, entity.weight);
    for (const tag of new Set(entity.tags)) add(tagTotals, tag, entity.weight);
    if (entity.brand) add(brandTotals, entity.brand, entity.weight);
  }

  const searches = raw.searches.slice(0, MAX_SEARCHES_COUNTED);
  const searchCategories = new Set<string>();
  for (const text of searches) {
    for (const category of categoriesForSearch(text, catalog)) {
      searchCategories.add(category);
      add(categoryTotals, category, ENTITY_WEIGHTS.searchCategory);
    }
  }

  const prices = [
    ...viewedUnique.map((entry) => byId.get(entry.productId)?.finalPrice ?? entry.price),
    ...raw.cart.map((entry) => byId.get(entry.productId)?.finalPrice ?? entry.price),
    ...raw.wishlist.map((entry) => byId.get(entry.productId)?.finalPrice ?? entry.price),
    ...purchasedProducts.map((product) => product.finalPrice),
  ].filter((price) => Number.isFinite(price) && price > 0);

  let dominantCategory: string | null = null;
  let best = 0;
  for (const [category, total] of categoryTotals) {
    if (total > best) {
      best = total;
      dominantCategory = category;
    }
  }

  const evidence =
    viewedUnique.length * EVIDENCE_POINTS.viewed +
    raw.wishlist.length * EVIDENCE_POINTS.wishlist +
    raw.cart.length * EVIDENCE_POINTS.cart +
    purchasedIds.length * EVIDENCE_POINTS.purchase +
    Math.min(searches.length, MAX_SEARCHES_COUNTED) * EVIDENCE_POINTS.search;

  return {
    viewedIds: viewedUnique.map((entry) => entry.productId),
    wishlistIds: raw.wishlist.map((entry) => entry.productId),
    cartIds: raw.cart.map((entry) => entry.productId),
    purchasedIds,
    viewedProducts,
    wishlistProducts,
    cartProducts,
    purchasedProducts,
    categoryAffinity: normalize(categoryTotals),
    tagAffinity: normalize(tagTotals),
    brandAffinity: normalize(brandTotals),
    priceBand: derivePriceBand(prices),
    searchCategories: [...searchCategories],
    searches,
    dominantCategory,
    coPurchases,
    evidence,
    confidence: Math.min(1, evidence / FULL_CONFIDENCE_EVIDENCE),
    counts: {
      viewed: viewedUnique.length,
      searches: searches.length,
      wishlist: raw.wishlist.length,
      cart: raw.cart.length,
      purchases: purchasedIds.length,
    },
  };
}

/** A short string that changes whenever the inputs that affect recommendations change (used as a cache key). */
export function fingerprintInputs(raw: RawSignals, catalog: readonly Product[]): string {
  let catalogSum = 0;
  for (const product of catalog) catalogSum = (catalogSum * 31 + product.id * 7 + product.stock * 3 + product.finalPrice) % 1_000_000_007;
  return JSON.stringify([
    raw.viewed.map((entry) => entry.productId),
    raw.searches.slice(0, MAX_SEARCHES_COUNTED),
    raw.wishlist.map((entry) => entry.productId),
    raw.cart.map((entry) => [entry.productId, entry.quantity]),
    raw.orders.map((order) => [order.placedAt, order.items.map((item) => item.productId)]),
    catalog.length,
    catalogSum,
  ]);
}
