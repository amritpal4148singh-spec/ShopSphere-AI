"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { ProductImage } from "@/features/products";
import { formatInr } from "@/lib/currency";
import { useCartStore } from "@/store/cart-store";
import type { CartLine as CartLineModel } from "@/types/cart";

interface CartLineProps {
  line: CartLineModel;
  /** A message from live data, e.g. the quantity was reduced because stock fell. */
  notice?: string;
}

const IMAGE_SIZES = "96px";

/** One cart row with its failure states shown in place (PRD 5.5): out of stock, unavailable, price changed. */
export function CartLine({ line, notice }: CartLineProps) {
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const saveForLater = useCartStore((state) => state.saveForLater);
  const confirmPrice = useCartStore((state) => state.confirmPrice);
  const dismissNotice = useCartStore((state) => state.dismissNotice);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const { item, status } = line;
  const purchasable = status === "ok";
  const atMax = purchasable && line.quantity >= line.availableStock;

  function changeQuantity(requested: number) {
    const outcome = setQuantity(item.key, requested, line.availableStock);
    if (outcome && !outcome.clamped) setLimitMessage(null);
  }

  return (
    <li className="flex gap-4 rounded-xl border bg-card shadow-surface p-4" data-status={status}>
      <div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-muted">
        <ProductImage src={item.thumbnail} sizes={IMAGE_SIZES} />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            {item.brand ? <p className="text-xs text-muted-foreground">{item.brand}</p> : null}
            <h3 className="font-medium">
              {status === "unavailable" ? (
                item.title
              ) : (
                <Link href={`/products/${item.productId}`} className="rounded-sm hover:underline">
                  {item.title}
                </Link>
              )}
            </h3>
            {item.variantLabel ? <p className="text-sm text-muted-foreground">{item.variantLabel}</p> : null}
          </div>
          <p className="text-right">
            <span className="block font-semibold">{purchasable ? formatInr(line.lineTotal) : formatInr(line.unitPrice * line.quantity)}</span>
            <span className="block text-xs text-muted-foreground">{`${formatInr(line.unitPrice)} each`}</span>
          </p>
        </div>

        {status === "unavailable" ? (
          <p role="status" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
            <strong>No longer available.</strong> This product is no longer sold. Remove it to continue to checkout.
          </p>
        ) : null}
        {status === "out-of-stock" ? (
          <p role="status" className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
            <strong>Out of stock.</strong> Remove it or save it for later to continue to checkout.
          </p>
        ) : null}

        {line.priceChange ? (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-accent px-3 py-2 text-sm text-accent-foreground">
            <p>
              <strong>Price changed.</strong>{" "}
              {`It was ${formatInr(line.priceChange.from)} and is now ${formatInr(line.priceChange.to)}.`}
            </p>
            <Button size="sm" variant="outline" onClick={() => confirmPrice(item.key, line.priceChange?.to ?? line.unitPrice)}>
              Accept new price
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <QuantityStepper
            value={line.quantity}
            max={line.availableStock}
            disabled={!purchasable}
            label={`Quantity for ${item.title}`}
            onChange={changeQuantity}
            onClamp={(requested, limit) =>
              setLimitMessage(`You asked for ${requested}, but only ${limit} ${limit === 1 ? "is" : "are"} in stock. The quantity is now ${limit}.`)
            }
          />
          <Button size="sm" variant="ghost" onClick={() => saveForLater(item.key)}>
            Save for later
          </Button>
          <Button size="sm" variant="ghost" aria-label={`Remove ${item.title} from cart`} onClick={() => removeItem(item.key)}>
            Remove
          </Button>
        </div>

        <p role="status" className="text-sm text-muted-foreground">
          {limitMessage ?? (atMax ? `That is all we have: the maximum is ${line.availableStock}.` : "")}
        </p>
        {notice ? (
          <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-warning">
            {notice}
            <button type="button" className="underline underline-offset-4" onClick={() => dismissNotice(item.key)}>
              Dismiss
            </button>
          </p>
        ) : null}
      </div>
    </li>
  );
}
