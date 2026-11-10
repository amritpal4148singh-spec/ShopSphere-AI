"use client";

import { Button } from "@/components/ui/button";
import { RadioCard } from "@/components/ui/radio-card";
import { formatInr } from "@/lib/currency";
import { DELIVERY_METHODS, computeCheckoutTotals, getDeliveryWindow } from "@/utils/checkout";
import { formatDeliveryDate } from "@/utils/delivery";
import type { DeliveryId } from "@/types/checkout";

interface DeliveryStepProps {
  deliveryId: DeliveryId;
  subtotal: number;
  couponCode: string | null;
  onChange: (id: DeliveryId) => void;
  onBack: () => void;
  onNext: () => void;
}

/** Step 3: choose a simulated delivery method; each shows its cost and estimated delivery window. */
export function DeliveryStep({ deliveryId, subtotal, couponCode, onChange, onBack, onNext }: DeliveryStepProps) {
  const today = new Date();

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      className="space-y-4"
      aria-labelledby="step-delivery"
    >
      <h2 id="step-delivery" className="section-title">
        Delivery method
      </h2>
      <fieldset className="space-y-2">
        <legend className="sr-only">Choose a delivery method</legend>
        {DELIVERY_METHODS.map((method) => {
          const fee = computeCheckoutTotals(subtotal, couponCode, method.id).shipping;
          const window = getDeliveryWindow(method, today);
          const range =
            method.etaDays[0] === method.etaDays[1]
              ? formatDeliveryDate(window.earliest)
              : `${formatDeliveryDate(window.earliest)} to ${formatDeliveryDate(window.latest)}`;
          return (
            <RadioCard
              key={method.id}
              name="delivery"
              value={method.id}
              checked={deliveryId === method.id}
              onChange={() => onChange(method.id)}
              title={method.label}
              description={`${method.description}. Estimated delivery: ${range} (simulated).`}
              extra={fee === 0 ? "Free" : formatInr(fee)}
            />
          );
        })}
      </fieldset>
      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue to summary</Button>
      </div>
    </form>
  );
}
