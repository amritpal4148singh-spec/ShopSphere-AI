"use client";

import { RecommendationRail } from "@/features/recommendations";
import { getItemCount } from "@/utils/cart";
import { useCartData } from "../hooks/use-cart-data";
import { CartLine } from "./cart-line";
import { CartSkeleton, EmptyCart, StaleBanner } from "./cart-states";
import { CartSummary } from "./cart-summary";
import { SavedItems } from "./saved-items";

export function CartView() {
  const { status, lines, savedLines, totals, blockers, couponCode, notices, catalog } = useCartData();

  if (status === "idle") return <CartSkeleton />;

  const empty = lines.length === 0;
  // The summary counts what is being paid for: out-of-stock and unavailable lines are not in the subtotal.
  const itemCount = getItemCount(lines.filter((line) => line.status === "ok").map((line) => ({ ...line.item, quantity: line.quantity })));

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="page-title">Shopping cart</h1>

      {catalog.isError ? <StaleBanner onRetry={() => void catalog.refetch()} retrying={catalog.isFetching} /> : null}
      {catalog.isPending && !empty ? (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Checking the latest prices and stock...
        </p>
      ) : null}

      {empty ? (
        <>
          <EmptyCart hasSaved={savedLines.length > 0} />
          <SavedItems lines={savedLines} />
        </>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <h2 className="sr-only">Items in your cart</h2>
            <ul className="space-y-4">
              {lines.map((line) => (
                <CartLine key={line.item.key} line={line} {...(notices[line.item.key] ? { notice: notices[line.item.key] } : {})} />
              ))}
            </ul>
            <SavedItems lines={savedLines} />
          </div>
          <CartSummary totals={totals} itemCount={itemCount} couponCode={couponCode} blockers={blockers} />
        </div>
      )}

      {empty ? null : <RecommendationRail strategy="cart-based" />}
    </section>
  );
}
