import { evaluateCoupon, type CouponResult } from "@/utils/coupons";
import type { CartItem, CartLine, CartSnapshot, CheckoutBlocker, NewCartItem } from "@/types/cart";

/** Simulated pricing rules (PRD 5.5: simulated shipping and tax). No real carrier or tax service is used. */
export const SHIPPING_FEE = 99;
export const FREE_SHIPPING_THRESHOLD = 999;
export const TAX_RATE = 0.18;

export function makeItemKey(productId: number, variantId: string | null): string {
  return `${productId}:${variantId ?? "-"}`;
}

/* ------------------------------------------------------------------ reducers (pure) */

export type AddOutcome =
  | { type: "added" | "incremented"; quantity: number }
  | { type: "limited"; quantity: number; limit: number }
  | { type: "out-of-stock" };

/**
 * Adds an item. The same product and variant increments the existing line instead of creating a duplicate
 * (PRD edge case 8), and the quantity never exceeds the stock the caller reports in `input.knownStock`.
 */
export function addToCart(snapshot: CartSnapshot, input: NewCartItem, now: number = Date.now()): { snapshot: CartSnapshot; outcome: AddOutcome } {
  const stock = Math.max(0, Math.floor(input.knownStock));
  if (stock === 0) return { snapshot, outcome: { type: "out-of-stock" } };

  const key = makeItemKey(input.productId, input.variantId);
  const requested = Math.max(1, Math.floor(input.quantity));
  const existing = snapshot.items.find((item) => item.key === key);

  if (!existing) {
    const quantity = Math.min(requested, stock);
    const item: CartItem = { ...input, key, quantity, knownStock: stock, addedAt: now };
    return {
      snapshot: { ...snapshot, items: [...snapshot.items, item] },
      outcome: quantity < requested ? { type: "limited", quantity, limit: stock } : { type: "added", quantity },
    };
  }

  const total = existing.quantity + requested;
  const quantity = Math.min(total, stock);
  const items = snapshot.items.map((item) => (item.key === key ? { ...item, quantity, knownStock: stock } : item));
  return {
    snapshot: { ...snapshot, items },
    outcome: quantity < total ? { type: "limited", quantity, limit: stock } : { type: "incremented", quantity },
  };
}

export interface QuantityOutcome {
  quantity: number;
  /** The most that can be bought right now. */
  limit: number;
  /** True when the requested quantity was reduced to fit the stock (PRD MOD-05-001). */
  clamped: boolean;
  requested: number;
}

export function setQuantity(
  snapshot: CartSnapshot,
  key: string,
  requested: number,
  stock: number,
): { snapshot: CartSnapshot; outcome: QuantityOutcome | null } {
  const existing = snapshot.items.find((item) => item.key === key);
  if (!existing) return { snapshot, outcome: null };

  const limit = Math.max(0, Math.floor(stock));
  const wanted = Number.isFinite(requested) ? Math.floor(requested) : existing.quantity;
  if (limit === 0) return { snapshot, outcome: { quantity: existing.quantity, limit, clamped: true, requested: wanted } };

  const quantity = Math.min(Math.max(wanted, 1), limit);
  const items = snapshot.items.map((item) => (item.key === key ? { ...item, quantity, knownStock: limit } : item));
  return { snapshot: { ...snapshot, items }, outcome: { quantity, limit, clamped: quantity !== wanted, requested: wanted } };
}

export function removeItem(snapshot: CartSnapshot, key: string): CartSnapshot {
  return { ...snapshot, items: snapshot.items.filter((item) => item.key !== key) };
}

export function removeSavedItem(snapshot: CartSnapshot, key: string): CartSnapshot {
  return { ...snapshot, saved: snapshot.saved.filter((item) => item.key !== key) };
}

function mergeLine(existing: CartItem, incoming: CartItem): CartItem {
  const limit = Math.max(existing.knownStock, incoming.knownStock);
  const total = existing.quantity + incoming.quantity;
  return {
    ...existing,
    knownStock: limit,
    quantity: limit > 0 ? Math.min(total, limit) : Math.max(existing.quantity, incoming.quantity),
  };
}

function upsert(list: CartItem[], item: CartItem): CartItem[] {
  return list.some((entry) => entry.key === item.key)
    ? list.map((entry) => (entry.key === item.key ? mergeLine(entry, item) : entry))
    : [...list, item];
}

/** Moves a line out of the active cart without deleting it (PRD 5.5 Save for Later). */
export function saveForLater(snapshot: CartSnapshot, key: string): CartSnapshot {
  const item = snapshot.items.find((entry) => entry.key === key);
  if (!item) return snapshot;
  return { ...snapshot, items: snapshot.items.filter((entry) => entry.key !== key), saved: upsert(snapshot.saved, item) };
}

export type MoveOutcome = { type: "moved"; quantity: number } | { type: "limited"; quantity: number; limit: number } | { type: "out-of-stock" } | { type: "missing" };

/** Moves a saved line back into the cart, respecting stock. */
export function moveToCart(snapshot: CartSnapshot, key: string, stock: number): { snapshot: CartSnapshot; outcome: MoveOutcome } {
  const saved = snapshot.saved.find((entry) => entry.key === key);
  if (!saved) return { snapshot, outcome: { type: "missing" } };

  const limit = Math.max(0, Math.floor(stock));
  if (limit === 0) return { snapshot, outcome: { type: "out-of-stock" } };

  const candidate: CartItem = { ...saved, knownStock: limit, quantity: Math.min(saved.quantity, limit) };
  const items = upsert(snapshot.items, candidate);
  const merged = items.find((entry) => entry.key === key) as CartItem;
  const remaining = snapshot.saved.filter((entry) => entry.key !== key);
  return {
    snapshot: { ...snapshot, items, saved: remaining },
    outcome: merged.quantity < saved.quantity ? { type: "limited", quantity: merged.quantity, limit } : { type: "moved", quantity: merged.quantity },
  };
}

export function setCoupon(snapshot: CartSnapshot, code: string | null): CartSnapshot {
  return { ...snapshot, couponCode: code };
}

export function confirmPrice(snapshot: CartSnapshot, key: string, price: number): CartSnapshot {
  return { ...snapshot, items: snapshot.items.map((item) => (item.key === key ? { ...item, unitPrice: price } : item)) };
}

/** Combines two carts (guest into account, PRD 4.3). Quantities add up but never exceed known stock. */
export function mergeSnapshots(base: CartSnapshot, incoming: CartSnapshot): CartSnapshot {
  return {
    items: incoming.items.reduce(upsert, base.items),
    saved: incoming.saved.reduce(upsert, base.saved),
    couponCode: base.couponCode ?? incoming.couponCode,
  };
}

/* ------------------------------------------------------------------ live data */

export interface LiveLineData {
  stock: number;
  price: number;
}

/** Looks up live data for a line. Returns null when the product is no longer returned by the API. */
export type LiveResolver = (item: CartItem) => LiveLineData | null;

/**
 * Refreshes last-known stock from live data and reduces any quantity above the stock, with a notice
 * (PRD 5.5: never silently accepted). Prices are deliberately NOT updated here: a changed price must be
 * confirmed by the shopper.
 */
export function reconcileSnapshot(
  snapshot: CartSnapshot,
  resolve: LiveResolver,
): { snapshot: CartSnapshot; notices: Record<string, string>; changed: boolean } {
  const notices: Record<string, string> = {};
  let changed = false;

  const items = snapshot.items.map((item) => {
    const live = resolve(item);
    if (!live) return item;
    let next = item;
    if (live.stock !== item.knownStock) next = { ...next, knownStock: live.stock };
    if (live.stock > 0 && item.quantity > live.stock) {
      next = { ...next, quantity: live.stock };
      notices[item.key] = `Only ${live.stock} ${live.stock === 1 ? "is" : "are"} in stock now, so the quantity was reduced to ${live.stock}.`;
    }
    if (next !== item) changed = true;
    return next;
  });

  const saved = snapshot.saved.map((item) => {
    const live = resolve(item);
    if (!live || live.stock === item.knownStock) return item;
    changed = true;
    return { ...item, knownStock: live.stock };
  });

  return changed ? { snapshot: { ...snapshot, items, saved }, notices, changed } : { snapshot, notices, changed: false };
}

/**
 * Builds display lines. `catalogLoaded` false means live data is unavailable (loading, or the API failed):
 * lines then use the last-known price and stock instead of disappearing (PRD 5.5 fallback).
 */
export function buildCartLines(items: readonly CartItem[], resolve: LiveResolver | null, catalogLoaded: boolean): CartLine[] {
  return items.map((item) => {
    const live = catalogLoaded && resolve ? resolve(item) : null;
    const stale = !catalogLoaded;

    if (catalogLoaded && !live) {
      return { item, status: "unavailable", availableStock: 0, unitPrice: item.unitPrice, priceChange: null, quantity: item.quantity, lineTotal: 0, stale };
    }

    const stock = live ? live.stock : item.knownStock;
    const unitPrice = live ? live.price : item.unitPrice;
    const status = stock > 0 ? "ok" : "out-of-stock";
    const quantity = status === "ok" ? Math.min(item.quantity, stock) : item.quantity;
    return {
      item,
      status,
      availableStock: stock,
      unitPrice,
      priceChange: live && live.price !== item.unitPrice ? { from: item.unitPrice, to: live.price } : null,
      quantity,
      lineTotal: status === "ok" ? unitPrice * quantity : 0,
      stale,
    };
  });
}

/** Only purchasable lines count towards the subtotal. */
export function getSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + (line.status === "ok" ? line.lineTotal : 0), 0);
}

export function getItemCount(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Lines that must be resolved before checkout (PRD 5.5 and edge cases 1 and 10). */
export function getCheckoutBlockers(lines: readonly CartLine[]): CheckoutBlocker[] {
  const blockers: CheckoutBlocker[] = [];
  for (const line of lines) {
    if (line.status === "unavailable") blockers.push({ key: line.item.key, title: line.item.title, reason: "unavailable" });
    else if (line.status === "out-of-stock") blockers.push({ key: line.item.key, title: line.item.title, reason: "out-of-stock" });
    else if (line.priceChange) blockers.push({ key: line.item.key, title: line.item.title, reason: "price-changed" });
  }
  return blockers;
}

/* ------------------------------------------------------------------ totals */

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  freeShipping: boolean;
  coupon: CouponResult | null;
}

export function computeTotals(subtotal: number, couponCode: string | null, now: Date = new Date()): CartTotals {
  const coupon = couponCode ? evaluateCoupon(couponCode, subtotal, now) : null;
  const discount = coupon?.ok ? coupon.discount : 0;
  const taxable = Math.max(0, subtotal - discount);

  const shippingWaived = coupon?.ok === true && coupon.freeShipping;
  const freeShipping = subtotal === 0 || shippingWaived || taxable >= FREE_SHIPPING_THRESHOLD;
  const shipping = freeShipping ? 0 : SHIPPING_FEE;
  const tax = Math.round(taxable * TAX_RATE);

  return { subtotal, discount, shipping, tax, total: taxable + shipping + tax, freeShipping, coupon };
}
