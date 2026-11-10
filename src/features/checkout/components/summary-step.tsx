"use client";

import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/currency";
import { getDeliveryMethod } from "@/utils/checkout";
import type { CartLine } from "@/types/cart";
import type { CheckoutDraft } from "@/types/checkout";

interface SummaryStepProps {
  draft: CheckoutDraft;
  lines: CartLine[];
  onEdit: (step: 1 | 2 | 3) => void;
  onBack: () => void;
  onNext: () => void;
}

/** Step 4: a last look at the items and the details entered, with a way back to fix any of them. */
export function SummaryStep({ draft, lines, onEdit, onBack, onNext }: SummaryStepProps) {
  const { customer, address } = draft;

  return (
    <div className="space-y-5" aria-labelledby="step-summary" role="group">
      <h2 id="step-summary" className="section-title">
        Review your order
      </h2>

      <ul aria-label="Items in your order" className="divide-y rounded-xl border bg-card shadow-surface">
        {lines.map((line) => (
          <li key={line.item.key} className="flex items-start justify-between gap-4 p-4 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{line.item.title}</p>
              {line.item.variantLabel ? <p className="text-muted-foreground">{line.item.variantLabel}</p> : null}
              <p className="text-muted-foreground">{`${line.quantity} × ${formatInr(line.unitPrice)}`}</p>
            </div>
            <p className="shrink-0 font-medium">{formatInr(line.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-3">
        <section aria-label="Customer details" className="rounded-xl border bg-card shadow-surface p-4 text-sm">
          <p className="font-semibold">Customer</p>
          <p className="mt-1 text-muted-foreground">{customer.name}</p>
          <p className="text-muted-foreground">{customer.email}</p>
          <p className="text-muted-foreground">{customer.phone}</p>
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0" onClick={() => onEdit(1)}>
            Edit details
          </Button>
        </section>
        <section aria-label="Delivery address" className="rounded-xl border bg-card shadow-surface p-4 text-sm">
          <p className="font-semibold">Deliver to</p>
          <p className="mt-1 text-muted-foreground">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
          </p>
          <p className="text-muted-foreground">{`${address.city}, ${address.state} ${address.pincode}`}</p>
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0" onClick={() => onEdit(2)}>
            Edit address
          </Button>
        </section>
        <section aria-label="Delivery method" className="rounded-xl border bg-card shadow-surface p-4 text-sm">
          <p className="font-semibold">Delivery</p>
          <p className="mt-1 text-muted-foreground">{getDeliveryMethod(draft.deliveryId).label}</p>
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto p-0" onClick={() => onEdit(3)}>
            Change delivery
          </Button>
        </section>
      </div>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext}>
          Continue to payment
        </Button>
      </div>
    </div>
  );
}
