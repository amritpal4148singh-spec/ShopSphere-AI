"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/currency";
import { useCartStore } from "@/store/cart-store";
import { TAX_RATE, type CartTotals } from "@/utils/cart";
import type { CheckoutBlocker } from "@/types/cart";
import { CouponForm } from "./coupon-form";

function blockerText(blocker: CheckoutBlocker): string {
  switch (blocker.reason) {
    case "out-of-stock":
      return `${blocker.title} is out of stock. Remove it or save it for later.`;
    case "unavailable":
      return `${blocker.title} is no longer available. Remove it.`;
    default:
      return `${blocker.title} changed price. Accept the new price.`;
  }
}

interface CartSummaryProps {
  totals: CartTotals;
  itemCount: number;
  couponCode: string | null;
  blockers: CheckoutBlocker[];
}

export function CartSummary({ totals, itemCount, couponCode, blockers }: CartSummaryProps) {
  const applyCoupon = useCartStore((state) => state.applyCoupon);
  const blocked = blockers.length > 0;

  return (
    <aside aria-label="Order summary" className="h-fit space-y-5 rounded-xl border bg-card shadow-surface p-5 lg:sticky lg:top-24">
      <h2 className="section-title">Order summary</h2>

      <CouponForm
        subtotal={totals.subtotal}
        appliedCode={couponCode}
        appliedResult={totals.coupon}
        onApply={applyCoupon}
        onRemove={() => applyCoupon(null)}
      />

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt>{`Subtotal (${itemCount} ${itemCount === 1 ? "item" : "items"})`}</dt>
          <dd>{formatInr(totals.subtotal)}</dd>
        </div>
        {totals.discount > 0 ? (
          <div className="flex justify-between text-primary">
            <dt>Discount</dt>
            <dd>{`-${formatInr(totals.discount)}`}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Shipping (simulated)</dt>
          <dd>{totals.shipping === 0 ? "Free" : formatInr(totals.shipping)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>{`Tax, ${Math.round(TAX_RATE * 100)}% GST (simulated)`}</dt>
          <dd>{formatInr(totals.tax)}</dd>
        </div>
        <div className="flex justify-between border-t pt-3 text-base font-semibold">
          <dt>Total</dt>
          <dd data-testid="cart-total">{formatInr(totals.total)}</dd>
        </div>
      </dl>

      {blocked ? (
        <div className="space-y-3">
          <Button size="lg" variant="cta" className="w-full" disabled aria-describedby="checkout-blockers">
            Proceed to Checkout
          </Button>
          <div id="checkout-blockers" className="space-y-1 text-sm text-destructive">
            <p className="font-medium">Fix these items to continue:</p>
            <ul className="list-disc pl-5">
              {blockers.map((blocker) => (
                <li key={blocker.key}>{blockerText(blocker)}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <Button asChild size="lg" variant="cta" className="w-full">
          <Link href="/checkout">Proceed to Checkout</Link>
        </Button>
      )}
    </aside>
  );
}
