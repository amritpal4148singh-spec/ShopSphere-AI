"use client";

import { FlaskConical, OctagonAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { formatInr } from "@/lib/currency";
import { PAYMENT_METHODS, getPaymentMethod, validatePayment } from "@/utils/checkout";
import type { PaymentMethodId, PaymentOutcome, PaymentSelection } from "@/types/checkout";

interface PaymentStepProps {
  payment: PaymentSelection;
  total: number;
  placing: boolean;
  /** Set when the last simulated payment was declined. Earlier steps keep their data (PRD edge case 14). */
  failure: string | null;
  showErrors: boolean;
  onChange: (payment: PaymentSelection) => void;
  onDismissFailure: () => void;
  onBack: () => void;
  onPlaceOrder: () => void;
}

/**
 * Step 5: a clearly labelled test-mode payment (PRD 5.6). It asks for a method and a simulated result only.
 * There is deliberately no card number, CVV, bank login or UPI PIN field.
 */
export function PaymentStep({ payment, total, placing, failure, showErrors, onChange, onDismissFailure, onBack, onPlaceOrder }: PaymentStepProps) {
  const errors = showErrors ? validatePayment(payment, total) : {};
  const method = payment.method ? getPaymentMethod(payment.method) : null;

  function chooseMethod(id: PaymentMethodId) {
    onChange({ ...payment, method: id, outcome: getPaymentMethod(id).usesOutcome ? payment.outcome : null });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onPlaceOrder();
      }}
      className="space-y-5"
      aria-labelledby="step-payment"
    >
      <h2 id="step-payment" className="section-title">
        Payment
      </h2>

      <div role="note" className="flex items-start gap-3 rounded-xl border border-warning bg-warning-soft p-4 text-sm text-warning">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong>Test mode.</strong> This is a simulated payment. No real money moves, and you will never be asked for a card number, CVV, bank login or UPI PIN.
        </p>
      </div>

      {failure ? (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border bg-card shadow-surface border-destructive p-4 text-sm text-destructive">
          <p className="flex items-start gap-2">
            <OctagonAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <span>
              <strong>Payment failed.</strong> {failure} Your details are saved. Try again, or choose another method.
            </span>
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onDismissFailure}>
            Try payment again
          </Button>
        </div>
      ) : null}

      <fieldset className="space-y-2" aria-describedby={errors.method ? "payment-method-error" : undefined}>
        <legend className="text-sm font-medium">Payment method</legend>
        {PAYMENT_METHODS.map((option) => (
          <RadioCard key={option.id} name="payment-method" value={option.id} checked={payment.method === option.id} onChange={() => chooseMethod(option.id)} title={option.label} description={option.description} />
        ))}
        {errors.method ? (
          <p id="payment-method-error" className="text-sm text-destructive">
            {errors.method}
          </p>
        ) : null}
      </fieldset>

      {method?.usesOutcome ? (
        <fieldset className="space-y-2" aria-describedby={errors.outcome ? "payment-outcome-error" : undefined}>
          <legend className="text-sm font-medium">Test result to simulate</legend>
          {([["approve", "Approve the payment", "The order will be placed."], ["decline", "Decline the payment", "Shows what happens when a payment fails."]] as Array<[PaymentOutcome, string, string]>).map(([value, title, description]) => (
            <RadioCard key={value} name="payment-outcome" value={value} checked={payment.outcome === value} onChange={() => onChange({ ...payment, outcome: value })} title={title} description={description} />
          ))}
          {errors.outcome ? (
            <p id="payment-outcome-error" className="text-sm text-destructive">
              {errors.outcome}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={payment.acknowledged}
            aria-describedby={errors.acknowledged ? "payment-ack-error" : undefined}
            onChange={(event) => onChange({ ...payment, acknowledged: event.target.checked })}
          />
          I understand this is a simulated test payment and no real money or financial details are used.
        </label>
        {errors.acknowledged ? (
          <p id="payment-ack-error" className="mt-1 text-sm text-destructive">
            {errors.acknowledged}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={placing}>
          Back
        </Button>
        <Button type="submit" size="lg" disabled={placing}>
          {placing ? "Processing test payment..." : `Place order (test mode) · ${formatInr(total)}`}
        </Button>
      </div>
    </form>
  );
}
