import Link from "next/link";
import { ShoppingBag, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CartSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <p role="status" className="sr-only">
        Loading your cart
      </p>
      <div aria-hidden="true">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ul className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="flex gap-4 rounded-xl border bg-card shadow-surface p-4">
                <div className="size-24 animate-pulse rounded-md bg-muted" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-9 w-32 animate-pulse rounded bg-muted" />
                </div>
              </li>
            ))}
          </ul>
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

export function EmptyCart({ hasSaved }: { hasSaved: boolean }) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
      <ShoppingBag aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="section-title">Your cart is empty</h2>
      <p className="max-w-md text-muted-foreground">
        {hasSaved ? "You have items saved for later below. Move one back to buy it." : "Find something you like and add it to your cart."}
      </p>
      <Button asChild>
        <Link href="/products">Browse Products</Link>
      </Button>
    </div>
  );
}

/** Live data could not be loaded, so the cart shows what it last knew (PRD 5.5, section 16 network failure). */
export function StaleBanner({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-accent px-4 py-3 text-sm">
      <p className="flex items-center gap-2">
        <WifiOff aria-hidden="true" className="size-4 shrink-0" />
        We could not check the latest prices and stock. Showing the details your cart last had.
      </p>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
}
