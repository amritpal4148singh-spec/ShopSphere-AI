import Link from "next/link";
import { PackageX } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
      <p role="status" className="sr-only">
        Loading product
      </p>
      <div aria-hidden="true" className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="aspect-square animate-pulse rounded-lg bg-muted" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="size-16 animate-pulse rounded-md bg-muted sm:size-20" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

/** The product was removed or never existed (PRD edge case 2): a clear page, not a crash or blank screen. */
export function ProductUnavailable() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <PackageX aria-hidden="true" className="size-10 text-muted-foreground" />
      <h1 className="mt-4 page-title">This product is no longer available</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        It may have been removed from the catalogue. You can keep browsing or search for something similar.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/products">Browse all products</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/search">Search</Link>
        </Button>
      </div>
    </section>
  );
}
