import { getPaymentMethod } from "@/utils/checkout";
import type { PaymentSelection } from "@/types/checkout";

export type PaymentResult = { ok: true; reference: string } | { ok: false; message: string };

export const PAYMENT_DELAY_MS = 900;

/**
 * Simulated payment (PRD 5.6). Everything happens in this function: nothing is sent anywhere, no card,
 * UPI or bank detail exists to send, and the result is decided by the test outcome the shopper picked.
 */
export async function simulatePayment(
  payment: PaymentSelection,
  options: { delayMs?: number; random?: () => number } = {},
): Promise<PaymentResult> {
  const { delayMs = PAYMENT_DELAY_MS, random = Math.random } = options;
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (payment.method === null) return { ok: false, message: "No payment method was chosen." };

  const method = getPaymentMethod(payment.method);
  if (method.usesOutcome && payment.outcome === "decline") {
    return { ok: false, message: `The test ${method.label} payment was declined (simulated). No money was taken.` };
  }

  return { ok: true, reference: `TEST-${Math.floor(random() * 1e8).toString().padStart(8, "0")}` };
}
