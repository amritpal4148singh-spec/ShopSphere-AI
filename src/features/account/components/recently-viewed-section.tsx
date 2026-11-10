"use client";

import Link from "next/link";
import { useId, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { ProductCard, useCatalog } from "@/features/products";
import { useViewedStore } from "@/store/viewed-store";

/** Recently viewed (PRD 5.7): the full history kept on this device, most recent first, not just the homepage preview. */
export function RecentlyViewedSection() {
  const status = useViewedStore((state) => state.status);
  const items = useViewedStore((state) => state.items);
  const catalog = useCatalog();
  const headingId = useId();

  const products = useMemo(() => {
    const byId = new Map((catalog.data ?? []).map((product) => [product.id, product]));
    return items.flatMap((item) => {
      const product = byId.get(item.productId);
      return product ? [product] : [];
    });
  }, [items, catalog.data]);

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-4 shadow-surface sm:p-6">
      <h2 id={headingId} className="section-title">
        Recently viewed
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Your full viewing history on this device, newest first.</p>

      {status !== "ready" || catalog.isPending ? (
        <div aria-busy="true" className="mt-4 h-40 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      ) : catalog.isError && products.length === 0 ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          We could not load your viewed products right now.{" "}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => void catalog.refetch()}>
            Try again
          </Button>
        </p>
      ) : products.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
          <p className="font-medium">Nothing viewed yet</p>
          <p className="text-sm text-muted-foreground">Products you open will be listed here.</p>
          <Button asChild>
            <Link href="/products">Browse products</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
