import { formatInr } from "@/lib/currency";

/** A small set of mock coupon codes (PRD 5.5). There is no coupon backend; these are the only valid codes. */
export interface Coupon {
  code: string;
  description: string;
  type: "percent" | "flat" | "free-shipping";
  /** Percent (1-100) or rupees. Unused for free-shipping. */
  value: number;
  maxDiscount?: number;
  minSubtotal?: number;
  /** ISO date-time after which the coupon is expired, or null for no expiry. */
  expiresAt: string | null;
}

export const COUPONS: readonly Coupon[] = [
  { code: "SAVE10", description: "10% off, up to ₹1,000", type: "percent", value: 10, maxDiscount: 1000, minSubtotal: 500, expiresAt: null },
  { code: "WELCOME200", description: "₹200 off orders over ₹1,500", type: "flat", value: 200, minSubtotal: 1500, expiresAt: null },
  { code: "FREESHIP", description: "Free shipping", type: "free-shipping", value: 0, expiresAt: null },
  { code: "SUMMER25", description: "25% off", type: "percent", value: 25, expiresAt: "2024-08-31T23:59:59.000Z" },
];

export type CouponFailure = "empty" | "not-found" | "expired" | "min-subtotal";

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; freeShipping: boolean }
  | { ok: false; reason: CouponFailure; message: string };

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Checks a code against the current subtotal. Never throws; the message is ready to show to the shopper. */
export function evaluateCoupon(code: string, subtotal: number, now: Date = new Date()): CouponResult {
  const normalized = normalizeCouponCode(code);
  if (normalized === "") return { ok: false, reason: "empty", message: "Enter a coupon code." };

  const coupon = COUPONS.find((candidate) => candidate.code === normalized);
  if (!coupon) {
    return { ok: false, reason: "not-found", message: `"${normalized}" is not a valid coupon code.` };
  }

  if (coupon.expiresAt !== null && Date.parse(coupon.expiresAt) < now.getTime()) {
    return {
      ok: false,
      reason: "expired",
      message: `${coupon.code} expired on ${dateFormatter.format(new Date(coupon.expiresAt))}.`,
    };
  }

  if (coupon.minSubtotal !== undefined && subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      reason: "min-subtotal",
      message: `${coupon.code} needs a subtotal of at least ${formatInr(coupon.minSubtotal)}. Add ${formatInr(coupon.minSubtotal - subtotal)} more to use it.`,
    };
  }

  let discount = 0;
  if (coupon.type === "percent") {
    discount = Math.floor((subtotal * coupon.value) / 100);
    if (coupon.maxDiscount !== undefined) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.type === "flat") {
    discount = Math.min(coupon.value, subtotal);
  }

  return { ok: true, coupon, discount, freeShipping: coupon.type === "free-shipping" };
}
