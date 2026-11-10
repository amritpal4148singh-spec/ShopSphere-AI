import { SHIPPING_FEE, computeTotals } from "@/utils/cart";
import {
  COD_LIMIT,
  DELIVERY_METHODS,
  computeCheckoutTotals,
  emptyDraft,
  generateOrderId,
  getDeliveryMethod,
  getDeliveryWindow,
  isAddressComplete,
  isCustomerComplete,
  normalizePhone,
  validateAddress,
  validateCustomer,
  validatePayment,
  validatePhone,
} from "./checkout";

describe("delivery methods (simulated)", () => {
  it("offers three options with different speeds and costs", () => {
    expect(DELIVERY_METHODS.map((method) => method.id)).toEqual(["standard", "express", "priority"]);
    expect(getDeliveryMethod("express")).toMatchObject({ fee: 149, etaDays: [2, 3] });
    expect(getDeliveryMethod("priority")).toMatchObject({ fee: 299, etaDays: [1, 1] });
  });

  it("computes the delivery window from a date without changing it", () => {
    const from = new Date(2026, 9, 14);
    const window = getDeliveryWindow(getDeliveryMethod("express"), from);
    expect(window.earliest.getDate()).toBe(16);
    expect(window.latest.getDate()).toBe(17);
    expect(from.getDate()).toBe(14);
  });
});

describe("computeCheckoutTotals", () => {
  it("keeps the cart's shipping rule for standard delivery", () => {
    for (const subtotal of [0, 500, 998, 999, 5000]) {
      expect(computeCheckoutTotals(subtotal, null, "standard").shipping).toBe(computeTotals(subtotal, null).shipping);
      expect(computeCheckoutTotals(subtotal, null, "standard").total).toBe(computeTotals(subtotal, null).total);
    }
  });

  it("charges the flat fee for faster delivery, even on a large order", () => {
    expect(computeCheckoutTotals(5000, null, "express").shipping).toBe(149);
    expect(computeCheckoutTotals(5000, null, "priority").shipping).toBe(299);
  });

  it("adds the shipping difference to the total and leaves tax unchanged", () => {
    const standard = computeCheckoutTotals(1000, null, "standard");
    const express = computeCheckoutTotals(1000, null, "express");
    expect(express.tax).toBe(standard.tax);
    expect(express.total).toBe(standard.total - standard.shipping + 149);
  });

  it("applies the coupon discount and lets a free-shipping coupon waive standard shipping only", () => {
    expect(computeCheckoutTotals(1000, "SAVE10", "express").discount).toBe(100);
    expect(computeCheckoutTotals(500, "FREESHIP", "standard").shipping).toBe(0);
    expect(computeCheckoutTotals(500, "FREESHIP", "express").shipping).toBe(149);
    expect(computeCheckoutTotals(500, null, "standard").shipping).toBe(SHIPPING_FEE);
  });

  it("charges no shipping for an empty cart", () => {
    expect(computeCheckoutTotals(0, null, "priority")).toMatchObject({ shipping: 0, total: 0 });
  });
});

describe("phone and customer validation", () => {
  it("normalizes common Indian number formats", () => {
    expect(normalizePhone("98765 43210")).toBe("9876543210");
    expect(normalizePhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
  });

  it("accepts a valid mobile number and rejects everything else with a specific message", () => {
    expect(validatePhone("9876543210")).toBeNull();
    expect(validatePhone("+91 98765 43210")).toBeNull();
    expect(validatePhone("")).toBe("Enter your mobile number.");
    expect(validatePhone("12345")).toBe("Enter a valid 10-digit mobile number.");
    expect(validatePhone("5876543210")).toBe("Enter a valid 10-digit mobile number.");
    expect(validatePhone("abcdefghij")).toBe("Enter a valid 10-digit mobile number.");
  });

  it("validates name, email and phone together", () => {
    expect(validateCustomer({ name: "Asha Rao", email: "asha@example.com", phone: "9876543210" })).toEqual({});
    expect(Object.keys(validateCustomer({ name: "", email: "bad", phone: "1" })).sort()).toEqual(["email", "name", "phone"]);
    expect(isCustomerComplete({ name: "Asha Rao", email: "asha@example.com", phone: "9876543210" })).toBe(true);
    expect(isCustomerComplete({ name: "", email: "", phone: "" })).toBe(false);
  });
});

describe("validateAddress", () => {
  const valid = { line1: "12 Demo Street", line2: "", city: "New Delhi", state: "Delhi", pincode: "110001" };

  it("accepts a complete address and treats line 2 as optional", () => {
    expect(validateAddress(valid)).toEqual({});
    expect(isAddressComplete(valid)).toBe(true);
  });

  it("flags each missing field", () => {
    const errors = validateAddress({ line1: "", line2: "", city: "", state: "", pincode: "" });
    expect(Object.keys(errors).sort()).toEqual(["city", "line1", "pincode", "state"]);
  });

  it("validates the PIN code format and field lengths", () => {
    expect(validateAddress({ ...valid, pincode: "12345" }).pincode).toBe("Enter a valid 6-digit PIN code.");
    expect(validateAddress({ ...valid, pincode: "012345" }).pincode).toBe("Enter a valid 6-digit PIN code.");
    expect(validateAddress({ ...valid, line1: "ab" }).line1).toBe("Street address must be 3 to 100 characters.");
    expect(validateAddress({ ...valid, line2: "x".repeat(101) }).line2).toBe("Keep this under 100 characters.");
    expect(validateAddress({ ...valid, city: "A" }).city).toBe("City must be 2 to 60 characters.");
  });
});

describe("validatePayment (client-side only)", () => {
  const ok = { method: "mock-card" as const, outcome: "approve" as const, acknowledged: true };

  it("accepts a complete test payment", () => {
    expect(validatePayment(ok, 1000)).toEqual({});
  });

  it("requires a method, a test result for card and UPI, and the test-mode acknowledgement", () => {
    expect(validatePayment({ method: null, outcome: null, acknowledged: false }, 1000)).toEqual({
      method: "Choose a test payment method.",
      acknowledged: "Confirm that you understand this is a test payment.",
    });
    expect(validatePayment({ ...ok, outcome: null }, 1000).outcome).toBe("Choose the test result to simulate.");
    expect(validatePayment({ method: "mock-upi", outcome: null, acknowledged: true }, 1000).outcome).toBeDefined();
  });

  it("does not ask for a test result for Cash on Delivery", () => {
    expect(validatePayment({ method: "mock-cod", outcome: null, acknowledged: true }, 1000)).toEqual({});
  });

  it("blocks Cash on Delivery above the limit and says why", () => {
    const errors = validatePayment({ method: "mock-cod", outcome: null, acknowledged: true }, COD_LIMIT + 1);
    expect(errors.method).toContain("not available for orders above ₹50,000");
    expect(validatePayment({ method: "mock-cod", outcome: null, acknowledged: true }, COD_LIMIT)).toEqual({});
  });
});

describe("emptyDraft", () => {
  it("starts at the first step with the customer's known details", () => {
    const draft = emptyDraft({ name: "Casey", email: "casey@example.com" }, 5);
    expect(draft).toMatchObject({ step: 1, maxStep: 1, deliveryId: "standard", updatedAt: 5 });
    expect(draft.customer).toEqual({ name: "Casey", email: "casey@example.com", phone: "" });
    expect(draft.payment).toEqual({ method: null, outcome: null, acknowledged: false });
  });
});

describe("generateOrderId", () => {
  it("formats an ID with the date and a five-character code", () => {
    const id = generateOrderId(new Date(2026, 9, 14), () => 0);
    expect(id).toBe("SS-20261014-AAAAA");
  });

  it("uses only unambiguous characters and varies with the random source", () => {
    const first = generateOrderId(new Date(2026, 0, 2), Math.random);
    expect(first).toMatch(/^SS-20260102-[A-HJ-NP-Z2-9]{5}$/);
    let n = 0;
    expect(generateOrderId(new Date(2026, 0, 2), () => (n++ % 7) / 7)).not.toBe(generateOrderId(new Date(2026, 0, 2), () => 0));
  });
});
