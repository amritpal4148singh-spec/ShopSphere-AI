"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProductImage } from "@/features/products";
import { formatInr } from "@/lib/currency";
import { useCartStore } from "@/store/cart-store";
import type { CartLine } from "@/types/cart";

function SavedRow({ line }: { line: CartLine }) {
  const moveToCart = useCartStore((state) => state.moveToCart);
  const removeSaved = useCartStore((state) => state.removeSaved);
  const [message, setMessage] = useState<string | null>(null);
  const reasonId = useId();
  const { item, status } = line;
  const canMove = status === "ok";

  function move() {
    const outcome = moveToCart(item.key, line.availableStock);
    if (outcome.type === "limited") setMessage(`Only ${outcome.limit} available, so ${outcome.quantity} moved to your cart.`);
    else if (outcome.type === "out-of-stock") setMessage("This item is out of stock.");
  }

  return (
    <li className="flex gap-4 rounded-xl border bg-card shadow-surface p-4">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        <ProductImage src={item.thumbnail} sizes="80px" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
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
          <p className="text-sm">{`${formatInr(line.unitPrice)} each`}</p>
        </div>
        {status !== "ok" ? (
          <p id={reasonId} className="text-sm text-destructive">
            {status === "unavailable" ? "No longer available." : "Out of stock."}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!canMove} aria-describedby={canMove ? undefined : reasonId} onClick={move}>
            Move to cart
          </Button>
          <Button size="sm" variant="ghost" aria-label={`Remove ${item.title} from saved items`} onClick={() => removeSaved(item.key)}>
            Remove
          </Button>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {message ?? ""}
        </p>
      </div>
    </li>
  );
}

/** Items moved out of the active cart with Save for Later (PRD 5.5). Not deleted, not counted in the total. */
export function SavedItems({ lines }: { lines: CartLine[] }) {
  if (lines.length === 0) return null;

  return (
    <section aria-labelledby="saved-heading" className="mt-10">
      <h2 id="saved-heading" className="section-title">
        {`Saved for later (${lines.length})`}
      </h2>
      <ul className="mt-4 space-y-4">
        {lines.map((line) => (
          <SavedRow key={line.item.key} line={line} />
        ))}
      </ul>
    </section>
  );
}
