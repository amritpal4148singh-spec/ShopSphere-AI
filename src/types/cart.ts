import type { Availability } from "@/types/product";

/** One cart line: a product, optionally a variant, with the last data we saw for it (the offline fallback). */
export interface CartItem {
  /** `${productId}:${variantId ?? "-"}`. Adding the same key again increments the quantity (PRD edge case 8). */
  key: string;
  productId: number;
  variantId: string | null;
  /** Display text such as "Size: 8". */
  variantLabel: string | null;
  quantity: number;
  title: string;
  brand: string | null;
  category: string;
  thumbnail: string | null;
  /** The unit price (INR) the shopper last saw and accepted. A different live price must be confirmed. */
  unitPrice: number;
  /** Last-known stock for this line, refreshed whenever live product data arrives. */
  knownStock: number;
  addedAt: number;
}

export type NewCartItem = Omit<CartItem, "key" | "addedAt">;

export interface CartSnapshot {
  items: CartItem[];
  /** "Save for Later" items: out of the active cart but not deleted. */
  saved: CartItem[];
  couponCode: string | null;
}

export type LineStatus = "ok" | "out-of-stock" | "unavailable";

/** A cart item combined with live product data (or the last-known data when the API is unavailable). */
export interface CartLine {
  item: CartItem;
  status: LineStatus;
  availableStock: number;
  /** Current unit price: the live price when known, otherwise the last confirmed price. */
  unitPrice: number;
  priceChange: { from: number; to: number } | null;
  /** Quantity after stock validation. */
  quantity: number;
  lineTotal: number;
  /** True when this line shows cached data because live data is unavailable. */
  stale: boolean;
}

export interface CheckoutBlocker {
  key: string;
  title: string;
  reason: "out-of-stock" | "unavailable" | "price-changed";
}

export interface WishlistItem {
  productId: number;
  title: string;
  brand: string | null;
  category: string;
  thumbnail: string | null;
  /** Price when the product was saved. */
  savedPrice: number;
  /** Last-known current price, refreshed from live data. */
  price: number;
  /** Last-known availability, refreshed from live data. */
  availability: Availability;
  addedAt: number;
}

export type NewWishlistItem = Omit<WishlistItem, "addedAt" | "savedPrice"> & { savedPrice?: number };

export type WishlistAvailability = Availability | "unavailable";

export interface WishlistLine {
  item: WishlistItem;
  availability: WishlistAvailability;
  price: number;
  priceChange: { from: number; to: number } | null;
  stale: boolean;
}
