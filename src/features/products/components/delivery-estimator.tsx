"use client";

import { Truck } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { estimateDelivery, formatDeliveryDate, isValidPincode, type DeliveryEstimate } from "@/utils/delivery";
import type { ProductDetail } from "@/types/product";

/** Simulated PIN-code delivery estimate plus the shipping, return and warranty text from the data source. */
export function DeliveryEstimator({ product, available }: { product: ProductDetail; available: boolean }) {
  const [pincode, setPincode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const headingId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidPincode(pincode)) {
      setError("Enter a valid 6-digit PIN code.");
      setEstimate(null);
      return;
    }
    setError(undefined);
    setEstimate(estimateDelivery(pincode, product.shippingInformation));
  }

  const details = [product.shippingInformation, product.returnPolicy, product.warrantyInformation].filter(
    (text): text is string => text !== null,
  );

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card shadow-surface p-4">
      <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold">
        <Truck aria-hidden="true" className="size-5" />
        Delivery
      </h2>

      {available ? (
        <form noValidate onSubmit={handleSubmit} className="mt-3 flex items-start gap-2">
          <div className="flex-1">
            <FormField
              label="PIN code"
              name="pincode"
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              value={pincode}
              error={error}
              onChange={(event) => setPincode(event.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <Button type="submit" variant="outline" className="mt-[1.65rem]">
            Check
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Delivery estimates are available once this item is back in stock.</p>
      )}

      {estimate ? (
        <p role="status" className="mt-3 text-sm">
          <span className="font-medium">Estimated delivery: </span>
          {`${formatDeliveryDate(estimate.earliest)} to ${formatDeliveryDate(estimate.latest)}`}
          <span className="block text-xs text-muted-foreground">Simulated estimate for this demo.</span>
        </p>
      ) : null}

      {details.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t pt-3 text-sm text-muted-foreground">
          {details.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
