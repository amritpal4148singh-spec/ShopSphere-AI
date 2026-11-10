import Link from "next/link";

import { formatInr } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { TAX_RATE } from "@/utils/cart";
import type { Order } from "@/types/order";

export function OrderItemsList({ order }: { order: Order }) {
  return (
    <ul aria-label="Items in this order" className="divide-y rounded-xl border bg-card shadow-surface">
      {order.items.map((item) => (
        <li key={`${item.productId}:${item.variantLabel ?? ""}`} className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="font-medium">
              <Link href={`/products/${item.productId}`} className="rounded-sm hover:underline">
                {item.title}
              </Link>
            </p>
            {item.variantLabel ? <p className="text-sm text-muted-foreground">{item.variantLabel}</p> : null}
            <p className="text-sm text-muted-foreground">{`${item.quantity} × ${formatInr(item.unitPrice)}`}</p>
          </div>
          <p className="shrink-0 font-medium">{formatInr(item.unitPrice * item.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotalsList({ order }: { order: Order }) {
  const { totals } = order;
  return (
    <dl aria-label="Order totals" className="space-y-2 rounded-xl border bg-card shadow-surface p-4 text-sm">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd>{formatInr(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 ? (
        <div className="flex justify-between text-primary">
          <dt>{totals.couponCode ? `Discount (${totals.couponCode})` : "Discount"}</dt>
          <dd>{`-${formatInr(totals.discount)}`}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt>{`Shipping, ${order.delivery.label} (simulated)`}</dt>
        <dd>{totals.shipping === 0 ? "Free" : formatInr(totals.shipping)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>{`Tax, ${Math.round(TAX_RATE * 100)}% GST (simulated)`}</dt>
        <dd>{formatInr(totals.tax)}</dd>
      </div>
      <div className="flex justify-between border-t pt-3 text-base font-semibold">
        <dt>Total</dt>
        <dd data-testid="order-total">{formatInr(totals.total)}</dd>
      </div>
    </dl>
  );
}

/** Delivery address, delivery method and payment method of an order. */
export function OrderInfoBlocks({ order }: { order: Order }) {
  const { address, customer } = order;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <section aria-labelledby="order-address" className="rounded-xl border bg-card shadow-surface p-4 text-sm">
        <h3 id="order-address" className="font-semibold">
          Delivery address
        </h3>
        <address className="mt-2 not-italic text-muted-foreground">
          {customer.name}
          <br />
          {address.line1}
          {address.line2 ? (
            <>
              <br />
              {address.line2}
            </>
          ) : null}
          <br />
          {`${address.city}, ${address.state} ${address.pincode}`}
          <br />
          {`Mobile: ${customer.phone}`}
        </address>
      </section>
      <section aria-labelledby="order-delivery" className="rounded-xl border bg-card shadow-surface p-4 text-sm">
        <h3 id="order-delivery" className="font-semibold">
          Delivery
        </h3>
        <p className="mt-2 text-muted-foreground">{order.delivery.label}</p>
        <p className="text-muted-foreground">{`Expected by ${formatDate(order.expectedDelivery)}`}</p>
      </section>
      <section aria-labelledby="order-payment" className="rounded-xl border bg-card shadow-surface p-4 text-sm">
        <h3 id="order-payment" className="font-semibold">
          Payment
        </h3>
        <p className="mt-2 text-muted-foreground">{`${order.payment.label} (test mode)`}</p>
        <p className="text-muted-foreground">No real payment was made.</p>
      </section>
    </div>
  );
}
