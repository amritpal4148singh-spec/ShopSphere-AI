import { computeTotals, type CartTotals } from "@/utils/cart";
import { formatInr } from "@/lib/currency";
import { isValidPincode } from "@/utils/delivery";
import { hasErrors, validateEmail, validateName, type FieldErrors } from "@/utils/validation";
import type {
  AddressFields,
  CheckoutDraft,
  CustomerInfo,
  DeliveryId,
  DeliveryMethod,
  PaymentMethodId,
  PaymentSelection,
} from "@/types/checkout";

/* ------------------------------------------------------------------ delivery (simulated) */

export const DELIVERY_METHODS: readonly DeliveryMethod[] = [
  { id: "standard", label: "Standard delivery", description: "Free on orders of ₹999 or more", etaDays: [5, 7], fee: null },
  { id: "express", label: "Express delivery", description: "Faster delivery for a flat fee", etaDays: [2, 3], fee: 149 },
  { id: "priority", label: "Priority next-day", description: "Arrives the next day", etaDays: [1, 1], fee: 299 },
];

export function getDeliveryMethod(id: DeliveryId): DeliveryMethod {
  return DELIVERY_METHODS.find((method) => method.id === id) ?? (DELIVERY_METHODS[0] as DeliveryMethod);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDeliveryWindow(method: DeliveryMethod, from: Date = new Date()): { earliest: Date; latest: Date } {
  return { earliest: addDays(from, method.etaDays[0]), latest: addDays(from, method.etaDays[1]) };
}

/* ------------------------------------------------------------------ totals */

export interface CheckoutTotals extends CartTotals {
  deliveryFee: number;
}

/**
 * Cart totals with the chosen delivery method's shipping. Discount and tax are the cart's; tax is charged
 * on the discounted subtotal, not on shipping. Standard delivery keeps the cart's shipping rule exactly.
 */
export function computeCheckoutTotals(subtotal: number, couponCode: string | null, deliveryId: DeliveryId, now: Date = new Date()): CheckoutTotals {
  const base = computeTotals(subtotal, couponCode, now);
  const method = getDeliveryMethod(deliveryId);
  const shipping = subtotal === 0 ? 0 : method.fee === null ? base.shipping : method.fee;

  return {
    ...base,
    shipping,
    freeShipping: shipping === 0,
    total: base.total - base.shipping + shipping,
    deliveryFee: shipping,
  };
}

/* ------------------------------------------------------------------ validation (PRD 13: every form) */

/** Digits only, without a leading +91 / 91 / 0. */
export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function validatePhone(value: string): string | null {
  if (value.trim() === "") return "Enter your mobile number.";
  return /^[6-9][0-9]{9}$/.test(normalizePhone(value)) ? null : "Enter a valid 10-digit mobile number.";
}

export function validateCustomer(customer: CustomerInfo): FieldErrors<keyof CustomerInfo> {
  const errors: FieldErrors<keyof CustomerInfo> = {};
  const name = validateName(customer.name);
  if (name) errors.name = name;
  const email = validateEmail(customer.email);
  if (email) errors.email = email;
  const phone = validatePhone(customer.phone);
  if (phone) errors.phone = phone;
  return errors;
}

export function validateAddress(address: AddressFields): FieldErrors<keyof AddressFields> {
  const errors: FieldErrors<keyof AddressFields> = {};
  const line1 = address.line1.trim();
  if (line1.length === 0) errors.line1 = "Enter your street address.";
  else if (line1.length < 3 || line1.length > 100) errors.line1 = "Street address must be 3 to 100 characters.";
  if (address.line2.trim().length > 100) errors.line2 = "Keep this under 100 characters.";
  const city = address.city.trim();
  if (city.length === 0) errors.city = "Enter your city.";
  else if (city.length < 2 || city.length > 60) errors.city = "City must be 2 to 60 characters.";
  const state = address.state.trim();
  if (state.length === 0) errors.state = "Enter your state.";
  else if (state.length < 2 || state.length > 60) errors.state = "State must be 2 to 60 characters.";
  if (address.pincode.trim() === "") errors.pincode = "Enter your PIN code.";
  else if (!isValidPincode(address.pincode)) errors.pincode = "Enter a valid 6-digit PIN code.";
  return errors;
}

/* ------------------------------------------------------------------ mock payment (client-side validation only) */

export const PAYMENT_METHODS: ReadonlyArray<{ id: PaymentMethodId; label: string; description: string; usesOutcome: boolean }> = [
  { id: "mock-card", label: "Mock Card", description: "A simulated card payment. No card details are asked for.", usesOutcome: true },
  { id: "mock-upi", label: "Mock UPI", description: "A simulated UPI payment. No UPI details or PIN are asked for.", usesOutcome: true },
  { id: "mock-cod", label: "Mock Cash on Delivery", description: "Pay when the order arrives (simulated).", usesOutcome: false },
];

/** Cash on Delivery is simulated as unavailable above this order value (a client-side rule to validate against). */
export const COD_LIMIT = 50000;

export function getPaymentMethod(id: PaymentMethodId) {
  return PAYMENT_METHODS.find((method) => method.id === id) as (typeof PAYMENT_METHODS)[number];
}

export function validatePayment(payment: PaymentSelection, total: number): FieldErrors<"method" | "outcome" | "acknowledged"> {
  const errors: FieldErrors<"method" | "outcome" | "acknowledged"> = {};
  if (payment.method === null) {
    errors.method = "Choose a test payment method.";
  } else {
    const method = getPaymentMethod(payment.method);
    if (method.usesOutcome && payment.outcome === null) errors.outcome = "Choose the test result to simulate.";
    if (payment.method === "mock-cod" && total > COD_LIMIT) {
      errors.method = `Cash on Delivery is not available for orders above ${formatInr(COD_LIMIT)}. Choose another method.`;
    }
  }
  if (!payment.acknowledged) errors.acknowledged = "Confirm that you understand this is a test payment.";
  return errors;
}

/* ------------------------------------------------------------------ draft and steps */

export const STEP_LABELS = ["Customer", "Address", "Delivery", "Summary", "Payment", "Confirmation"] as const;

export function emptyDraft(prefill: { name?: string; email?: string } = {}, now: number = Date.now()): CheckoutDraft {
  return {
    step: 1,
    maxStep: 1,
    customer: { name: prefill.name ?? "", email: prefill.email ?? "", phone: "" },
    address: { line1: "", line2: "", city: "", state: "", pincode: "", savedAddressId: null, saveAddress: false },
    deliveryId: "standard",
    payment: { method: null, outcome: null, acknowledged: false },
    updatedAt: now,
  };
}

export function isCustomerComplete(customer: CustomerInfo): boolean {
  return !hasErrors(validateCustomer(customer));
}

export function isAddressComplete(address: AddressFields): boolean {
  return !hasErrors(validateAddress(address));
}

/** Order IDs avoid look-alike characters (0/O, 1/I). */
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderId(now: Date = new Date(), random: () => number = Math.random): string {
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  let suffix = "";
  for (let i = 0; i < 5; i++) suffix += ID_ALPHABET.charAt(Math.floor(random() * ID_ALPHABET.length));
  return `SS-${date}-${suffix}`;
}
