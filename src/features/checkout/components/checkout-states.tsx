import Link from "next/link";
import { ShoppingBag, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CheckoutBlocker } from "@/types/cart";

export function CheckoutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <p role="status" className="sr-only">
        Loading checkout
      </p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
          <div className="h-56 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function EmptyCheckout() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <ShoppingBag aria-hidden="true" className="size-10 text-muted-foreground" />
      <h1 className="mt-4 page-title">There is nothing to check out</h1>
      <p className="mt-3 max-w-md text-muted-foreground">Your cart is empty. Add something first.</p>
      <Button asChild className="mt-6">
        <Link href="/products">Browse Products</Link>
      </Button>
    </section>
  );
}

const REASON_TEXT: Record<CheckoutBlocker["reason"], string> = {
  "out-of-stock": "is out of stock.",
  unavailable: "is no longer available.",
  "price-changed": "changed price and needs your confirmation.",
};

/** The cart has items that must be resolved first (PRD 5.5), so checkout does not start with a broken cart. */
export function CartNeedsAttention({ blockers }: { blockers: CheckoutBlocker[] }) {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <TriangleAlert aria-hidden="true" className="size-10 text-destructive" />
      <h1 className="mt-4 page-title">Review your cart before checking out</h1>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
        {blockers.map((blocker) => (
          <li key={blocker.key}>{`${blocker.title} ${REASON_TEXT[blocker.reason]}`}</li>
        ))}
      </ul>
      <Button asChild className="mt-6">
        <Link href="/cart">Go to your cart</Link>
      </Button>
    </section>
  );
}

export function PlacingOrder() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <p role="status" className="text-lg font-medium">
        Placing your order...
      </p>
    </section>
  );
}
