"use client";

import Link from "next/link";
import { Heart, WifiOff } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProductImage } from "@/features/products";
import { RecommendationRail } from "@/features/recommendations";
import { formatInr } from "@/lib/currency";
import { getVariantGroup } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { getAvailableStock, getDefaultVariantId } from "@/utils/purchase";
import type { NewCartItem, WishlistLine } from "@/types/cart";
import type { Product } from "@/types/product";
import { useWishlistData } from "../hooks/use-wishlist-data";

const AVAILABILITY_TEXT = {
  "in-stock": { text: "In stock", className: "text-primary" },
  "low-stock": { text: "Only a few left", className: "text-warning" },
  "out-of-stock": { text: "Out of stock", className: "text-destructive" },
  unavailable: { text: "No longer available", className: "text-destructive" },
} as const;

/** The cart line for a wishlisted product: its first in-stock variant (if it has variants) and quantity 1. */
function toCartInput(product: Product): NewCartItem | null {
  const group = getVariantGroup(product);
  const variantId = getDefaultVariantId(group);
  const stock = getAvailableStock(product.stock, group, variantId);
  if (stock <= 0) return null;
  const option = group?.options.find((candidate) => candidate.id === variantId);

  return {
    productId: product.id,
    variantId: group ? variantId : null,
    variantLabel: group && option ? `${group.label}: ${option.label}` : null,
    quantity: 1,
    title: product.title,
    brand: product.brand,
    category: product.category,
    thumbnail: product.thumbnail,
    unitPrice: product.finalPrice,
    knownStock: stock,
  };
}

function WishlistRow({ line, product }: { line: WishlistLine; product: Product | undefined }) {
  const addItem = useCartStore((state) => state.addItem);
  const removeFromWishlist = useWishlistStore((state) => state.remove);
  const [message, setMessage] = useState<string | null>(null);
  const reasonId = useId();

  const { item, availability } = line;
  const status = AVAILABILITY_TEXT[availability];
  const outOfStock = availability === "out-of-stock" || availability === "unavailable";
  const canMove = !outOfStock && !line.stale && product !== undefined;

  function moveToCart() {
    const input = product ? toCartInput(product) : null;
    if (!input) {
      setMessage("This item is out of stock.");
      return;
    }
    const outcome = addItem(input);
    if (outcome.type === "added" || outcome.type === "incremented" || outcome.type === "limited") {
      removeFromWishlist(item.productId);
    } else {
      setMessage(outcome.type === "out-of-stock" ? "This item is out of stock." : "Your cart is still loading. Try again in a moment.");
    }
  }

  const reason = outOfStock ? "Out of stock items cannot be moved to the cart." : line.stale ? "Reconnect to move items to your cart." : undefined;

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-surface" data-availability={availability}>
      <div className="relative aspect-square bg-muted">
        <ProductImage src={item.thumbnail} sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw" />
        {outOfStock ? (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/80 px-2 py-1 text-center text-xs font-medium text-background">
            {availability === "unavailable" ? "No longer available" : "Out of stock"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {item.brand ? <p className="text-xs text-muted-foreground">{item.brand}</p> : null}
        <h3 className="line-clamp-2 text-sm font-medium">
          {availability === "unavailable" ? (
            item.title
          ) : (
            <Link href={`/products/${item.productId}`} className="rounded-sm hover:underline">
              {item.title}
            </Link>
          )}
        </h3>

        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold">{formatInr(line.price)}</span>
          {line.priceChange ? (
            <span className="text-xs text-muted-foreground">{`was ${formatInr(line.priceChange.from)} when saved`}</span>
          ) : null}
        </p>
        <p className={`text-sm font-medium ${status.className}`}>{status.text}</p>

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={!canMove} aria-describedby={reason ? reasonId : undefined} onClick={moveToCart}>
            Move to Cart
          </Button>
          <Button size="sm" variant="ghost" aria-label={`Remove ${item.title} from wishlist`} onClick={() => removeFromWishlist(item.productId)}>
            Remove
          </Button>
        </div>
        {reason ? (
          <p id={reasonId} className="text-xs text-muted-foreground">
            {reason}
          </p>
        ) : null}
        <p role="status" className="text-xs text-muted-foreground">
          {message ?? ""}
        </p>
      </div>
    </li>
  );
}

function WishlistSkeleton() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <p role="status" className="sr-only">
        Loading your wishlist
      </p>
      <div aria-hidden="true">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <li key={index} className="space-y-2 rounded-xl border bg-card shadow-surface p-3">
              <div className="aspect-square animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function WishlistView() {
  const { status, ownerId, lines, catalog, products } = useWishlistData();

  if (status === "idle") return <WishlistSkeleton />;

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="page-title">Wishlist</h1>

      {ownerId === null ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Your wishlist is kept for this browser session only.{" "}
          <Link href="/login?next=%2Fwishlist" className="font-medium text-primary underline underline-offset-4">
            Sign in
          </Link>{" "}
          to keep it.
        </p>
      ) : null}

      {catalog.isError ? (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-accent px-4 py-3 text-sm">
          <p className="flex items-center gap-2">
            <WifiOff aria-hidden="true" className="size-4 shrink-0" />
            We could not check the latest prices and stock. Showing what was last known.
          </p>
          <Button size="sm" variant="outline" onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>
            {catalog.isFetching ? "Retrying..." : "Retry"}
          </Button>
        </div>
      ) : null}

      {lines.length === 0 ? (
        <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
          <Heart aria-hidden="true" className="size-8 text-muted-foreground" />
          <h2 className="section-title">Your wishlist is empty</h2>
          <p className="max-w-md text-muted-foreground">Tap the heart on any product to save it here for later.</p>
          <Button asChild>
            <Link href="/products">Browse Products</Link>
          </Button>
        </div>
      ) : (
        <>
          <p aria-live="polite" className="mt-4 text-sm text-muted-foreground">
            {`${lines.length} ${lines.length === 1 ? "item" : "items"}`}
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {lines.map((line) => (
              <WishlistRow key={line.item.productId} line={line} product={products.get(line.item.productId)} />
            ))}
          </ul>
        </>
      )}

      {lines.length === 0 ? null : <RecommendationRail strategy="wishlist-based" />}
    </section>
  );
}
