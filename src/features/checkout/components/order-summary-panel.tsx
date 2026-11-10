import { formatInr } from "@/lib/currency";
import { TAX_RATE } from "@/utils/cart";
import type { CheckoutTotals } from "@/utils/checkout";

/** Running totals shown beside every step, updated when the delivery method changes. */
export function OrderSummaryPanel({ totals, itemCount }: { totals: CheckoutTotals; itemCount: number }) {
  return (
    <aside aria-label="Order total" className="h-fit space-y-3 rounded-xl border bg-card shadow-surface p-5 lg:sticky lg:top-24">
      <h2 className="section-title">Order total</h2>
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
          <dd data-testid="checkout-total">{formatInr(totals.total)}</dd>
        </div>
      </dl>
    </aside>
  );
}
