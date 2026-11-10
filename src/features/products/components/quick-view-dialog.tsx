"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatInr } from "@/lib/currency";
import { ApiError } from "@/services/products";
import { useProduct } from "../hooks/use-product";
import { ProductImage } from "./product-image";
import { PurchasePanel } from "./purchase-panel";

interface QuickViewDialogProps {
  productId: number;
  title: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Quick View (PRD 5.2): the essentials of a product in a dialog, without leaving the grid. It reuses the product page's
 * data query and its PurchasePanel, so variants, stock limits, duplicate adds and the cart all behave exactly as on the page.
 */
export function QuickViewDialog({ productId, title, open, onClose }: QuickViewDialogProps) {
  const query = useProduct(open ? productId : null);
  const product = query.data;

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {query.isPending ? (
        <div aria-busy="true" aria-label="Loading product" className="grid gap-6 sm:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-10 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ) : query.isError && !product ? (
        <div role="alert" className="space-y-3">
          <p className="font-medium">
            {query.error instanceof ApiError && query.error.status === 404 ? "This product is no longer available." : "We could not load this product right now."}
          </p>
          <div className="flex gap-2">
            {!(query.error instanceof ApiError && query.error.status === 404) ? (
              <Button type="button" onClick={() => void query.refetch()}>
                Try again
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : product ? (
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <ProductImage src={product.thumbnail ?? product.images[0] ?? null} sizes="(min-width: 640px) 320px, 90vw" alt={product.title} />
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              {product.brand ? <p className="text-sm text-muted-foreground">{product.brand}</p> : null}
              {product.rating > 0 ? (
                <p className="flex items-center gap-1.5 text-sm" role="img" aria-label={`Rated ${product.rating.toFixed(1)} out of 5`}>
                  <Star aria-hidden="true" className="size-4 fill-current text-star" />
                  <span aria-hidden="true">{product.rating.toFixed(1)}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No ratings yet</p>
              )}
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-3xl font-semibold tracking-tight">{formatInr(product.finalPrice)}</span>
                {product.finalPrice < product.price ? (
                  <>
                    <span className="text-muted-foreground line-through">
                      <span className="sr-only">Original price </span>
                      {formatInr(product.price)}
                    </span>
                    <span className="rounded-full bg-sale px-2 py-0.5 text-xs font-bold text-sale-foreground">{`${Math.round(product.discountPercentage)}% off`}</span>
                  </>
                ) : null}
              </p>
            </div>

            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{product.description}</p>

            <PurchasePanel product={product} />

            <Link href={`/products/${product.id}`} onClick={onClose} className="inline-block rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline">
              View full details
            </Link>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
