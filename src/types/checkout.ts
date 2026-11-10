export interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
}

export interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

/** A saved address of a registered customer (PRD 5.6: saved-address option). */
export interface SavedAddress extends AddressFields {
  id: string;
  label: string;
  /** The address checkout pre-selects (PRD 5.7). At most one address is the default. */
  isDefault?: boolean;
}

export type DeliveryId = "standard" | "express" | "priority";

export interface DeliveryMethod {
  id: DeliveryId;
  label: string;
  description: string;
  /** Simulated delivery window in days from placing the order: [fastest, slowest]. */
  etaDays: readonly [number, number];
  /** Flat fee in INR, or null when the standard shipping rule applies (free above a threshold). */
  fee: number | null;
}

export type PaymentMethodId = "mock-card" | "mock-upi" | "mock-cod";
export type PaymentOutcome = "approve" | "decline";

/** Test-mode payment choice. No card number, CVV, bank login or UPI PIN is ever requested (PRD 5.6). */
export interface PaymentSelection {
  method: PaymentMethodId | null;
  /** The simulated result for Mock Card and Mock UPI. */
  outcome: PaymentOutcome | null;
  acknowledged: boolean;
}

export type CheckoutStep = 1 | 2 | 3 | 4 | 5;

/** Everything entered so far, persisted so a refresh or session expiry never loses it (PRD MOD-06-001/002). */
export interface CheckoutDraft {
  step: CheckoutStep;
  /** Furthest step reached, so completed steps can be revisited. */
  maxStep: CheckoutStep;
  customer: CustomerInfo;
  address: AddressFields & { savedAddressId: string | null; saveAddress: boolean };
  deliveryId: DeliveryId;
  payment: PaymentSelection;
  updatedAt: number;
}
