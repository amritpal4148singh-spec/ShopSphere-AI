"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { formatInr } from "@/lib/currency";
import { COUPONS, evaluateCoupon, normalizeCouponCode, type CouponResult } from "@/utils/coupons";

interface CouponFormProps {
  subtotal: number;
  appliedCode: string | null;
  /** How the applied coupon evaluates against the current cart. */
  appliedResult: CouponResult | null;
  onApply: (code: string) => void;
  onRemove: () => void;
}

/** Coupon entry with clear invalid, expired and below-minimum states (PRD 5.5). */
export function CouponForm({ subtotal, appliedCode, appliedResult, onApply, onRemove }: CouponFormProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = evaluateCoupon(value, subtotal);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(undefined);
    setValue("");
    onApply(normalizeCouponCode(value));
  }

  if (appliedCode) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Coupon</p>
        <div className="flex items-center justify-between gap-3 rounded-md border bg-accent px-3 py-2 text-sm text-accent-foreground">
          <p role="status">
            {appliedResult?.ok
              ? `${appliedCode} applied. You save ${formatInr(appliedResult.discount)}${appliedResult.freeShipping ? " (free shipping)" : ""}.`
              : (appliedResult?.message ?? `${appliedCode} cannot be applied.`)}
          </p>
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <FormField
            label="Coupon code"
            name="coupon"
            autoComplete="off"
            maxLength={20}
            value={value}
            error={error}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(undefined);
            }}
          />
        </div>
        <Button type="submit" variant="outline" className="mt-[1.65rem]">
          Apply
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{`Demo codes: ${COUPONS.map((coupon) => coupon.code).join(", ")} (SUMMER25 is expired).`}</p>
    </form>
  );
}
