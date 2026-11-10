
"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Eye, Sparkles, Star } from "lucide-react";
import { memo, useState } from "react";

import { CompareToggle } from "@/components/ui/compare-toggle";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { useCompareToggle } from "@/hooks/use-compare-toggle";
import { useWishlistToggle } from "@/hooks/use-wishlist-toggle";
import { formatInr } from "@/lib/currency";
import { isOnSale } from "@/utils/discovery";
import type { Product } from "@/types/product";
import { ProductImage } from "./product-image";

// Loaded on first use: most shoppers never open Quick View.
const QuickViewDialog = dynamic(
  () => import("./quick-view-dialog").then((module) => module.QuickViewDialog),
  { ssr: false },
);

const IMAGE_SIZES =
  "(min-width: 1536px) 18vw, (min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw";

interface ProductCardProps {
  product: Product;
  /** Why this product is shown (recommendation rails). */
  reason?: string;
}

function ProductCardComponent({ product, reason }: ProductCardProps) {
  const { pressed, toggle } = useWishlistToggle(product);
  const compare = useCompareToggle(product);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  const onSale = isOnSale(product);
  const outOfStock = product.availability === "out-of-stock";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_1px_0_rgb(20_19_43/0.04),0_10px_24px_-16px_rgb(20_19_43/0.3)] transition duration-300 ease-out has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background hover:-translate-y-1 hover:border-gold hover:shadow-[0_2px_0_rgb(20_19_43/0.03),0_22px_36px_-18px_color-mix(in_srgb,var(--primary)_35%,transparent)] motion-reduce:hover:translate-y-0">

      {/* Product image and hover Quick View */}
      <div className="relative aspect-square overflow-hidden bg-[radial-gradient(circle_at_50%_38%,var(--surface),var(--muted))]">
        <ProductImage
          src={product.thumbnail}
          sizes={IMAGE_SIZES}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.07] motion-reduce:transform-none"
        />

        {/* Subtle image overlay on hover */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />

        {onSale ? (
          <span
            data-discount-badge
            className="absolute left-3 top-3 rounded-full bg-sale px-2.5 py-1 text-xs font-bold leading-none text-sale-foreground shadow-sm"
          >
            {`${Math.round(product.discountPercentage)}% off`}
          </span>
        ) : null}

        {outOfStock ? (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/85 px-2 py-1.5 text-center text-xs font-semibold text-background">
            Out of stock
          </span>
        ) : null}

        {/* Desktop: appears on hover. Touch devices: compact eye button stays visible. */}
        <button
          type="button"
          onClick={() => setQuickViewOpen(true)}
          aria-label={`Quick view ${product.title}`}
          className="absolute bottom-3 left-1/2 z-20 inline-flex h-10 -translate-x-1/2 translate-y-2 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/50 bg-card/95 px-4 text-xs font-bold text-primary opacity-0 shadow-[0_8px_24px_-8px_rgb(11_22_41/0.4)] backdrop-blur-md transition-all duration-300 ease-out hover:border-gold hover:bg-cream hover:shadow-[0_10px_26px_-8px_rgb(11_22_41/0.5)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [@media(hover:none)]:size-10 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:rounded-full [@media(hover:none)]:p-0 [@media(hover:none)]:opacity-100"
        >
          <Eye aria-hidden="true" className="size-4 shrink-0" />
          <span className="[@media(hover:none)]:hidden">
            Quick View
          </span>
        </button>
      </div>

      {/* Product information */}
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {product.brand ? (
          <p className="text-xs font-medium text-muted-foreground">
            {product.brand}
          </p>
        ) : null}

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          <Link
            href={`/products/${product.id}`}
            className="rounded-sm after:absolute after:inset-0 focus-visible:outline-none"
          >
            {product.title}
          </Link>
        </h3>

        {product.rating > 0 ? (
          <p
            className="flex items-center gap-1 text-xs text-muted-foreground"
            role="img"
            aria-label={`Rated ${product.rating.toFixed(1)} out of 5`}
          >
            <Star
              aria-hidden="true"
              className="size-3.5 fill-current text-star"
            />
            <span aria-hidden="true">{product.rating.toFixed(1)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No ratings yet</p>
        )}

        {reason ? (
          <p className="flex items-start gap-1 text-xs font-semibold leading-snug text-gold-ink">
            <Sparkles
              aria-hidden="true"
              className="mt-px size-3 shrink-0"
            />
            <span className="line-clamp-2">{reason}</span>
          </p>
        ) : null}

        <p className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2">
          <span className="text-lg font-bold tracking-tight">
            {formatInr(product.finalPrice)}
          </span>

          {onSale ? (
            <span className="text-sm text-muted-foreground line-through">
              <span className="sr-only">Original price </span>
              {formatInr(product.price)}
            </span>
          ) : null}
        </p>

        {product.availability === "low-stock" ? (
          <p className="text-xs font-semibold text-destructive">
            Only a few left
          </p>
        ) : null}

        {/* Compare remains available without opening Quick View */}
        <div className="relative z-10 mt-2 flex flex-wrap gap-2">
          <CompareToggle
            name={product.title}
            pressed={compare.pressed}
            limitReached={compare.limitReached}
            onToggle={compare.toggle}
          />
        </div>

        {quickViewOpen ? (
          <QuickViewDialog
            productId={product.id}
            title={product.title}
            open
            onClose={() => setQuickViewOpen(false)}
          />
        ) : null}
      </div>

      <FavoriteButton
        name={product.title}
        pressed={pressed}
        onToggle={toggle}
        className="absolute right-2.5 top-2.5 z-10"
      />
    </article>
  );
}

export const ProductCard = memo(ProductCardComponent);
