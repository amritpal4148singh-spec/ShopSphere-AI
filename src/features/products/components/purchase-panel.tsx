"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { getVariantGroup } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import { cn } from "@/lib/utils";
import { clampQuantity, getAvailableStock, getDefaultVariantId, getStockInfo } from "@/utils/purchase";
import type { AddOutcome } from "@/utils/cart";
import type { NewCartItem } from "@/types/cart";
import type { ProductDetail } from "@/types/product";
import { VariantSelector } from "./variant-selector";

type ActionOutcome = AddOutcome | { type: "not-ready" };

function describeOutcome(outcome: ActionOutcome): { text: string; success: boolean } {
  switch (outcome.type) {
    case "added":
      return { text: outcome.quantity === 1 ? "Added to your cart." : `Added ${outcome.quantity} to your cart.`, success: true };
    case "incremented":
      return { text: `This item was already in your cart. The quantity is now ${outcome.quantity}.`, success: true };
    case "limited":
      return { text: `Only ${outcome.limit} available, so your cart now has ${outcome.quantity} (the maximum).`, success: true };
    case "out-of-stock":
      return { text: "Sorry, this item is out of stock and cannot be added.", success: false };
    default:
      return { text: "Your cart is still loading. Please try again in a moment.", success: false };
  }
}

/**
 * Variant choice, stock indicator, stock-bounded quantity, and the Add to Cart / Buy Now actions
 * (PRD MOD-04-001 for the out-of-stock case). Buy Now adds the item, then goes to checkout.
 */
export function PurchasePanel({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const group = useMemo(() => getVariantGroup(product), [product]);
  const [variantId, setVariantId] = useState<string | null>(() => getDefaultVariantId(group));
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<{ text: string; success: boolean } | null>(null);
  const explanationId = useId();

  const stock = getAvailableStock(product.stock, group, variantId);
  const info = getStockInfo(stock, group);
  const soldOut = info.state === "out";
  const effectiveQuantity = clampQuantity(quantity, stock);

  function selectVariant(id: string) {
    setVariantId(id);
    setResult(null);
    setQuantity((current) => clampQuantity(current, getAvailableStock(product.stock, group, id)));
  }

  function addToCart(): ActionOutcome {
    const option = group?.options.find((candidate) => candidate.id === variantId);
    const input: NewCartItem = {
      productId: product.id,
      variantId: group ? variantId : null,
      variantLabel: group && option ? `${group.label}: ${option.label}` : null,
      quantity: effectiveQuantity,
      title: product.title,
      brand: product.brand,
      category: product.category,
      thumbnail: product.thumbnail ?? product.images[0] ?? null,
      unitPrice: product.finalPrice,
      knownStock: stock,
    };
    const outcome = addItem(input);
    setResult(describeOutcome(outcome));
    return outcome;
  }

  function buyNow() {
    const outcome = addToCart();
    if (outcome.type === "added" || outcome.type === "incremented" || outcome.type === "limited") router.push("/checkout");
  }

  return (
    <div className="space-y-5">
      {group ? <VariantSelector group={group} selectedId={variantId} onSelect={selectVariant} /> : null}

      <p
        role="status"
        className={cn(
          "text-sm font-medium",
          info.state === "in" && "text-primary",
          info.state === "low" && "text-warning",
          info.state === "out" && "text-destructive",
        )}
      >
        {info.text}
      </p>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Quantity</span>
        <QuantityStepper value={effectiveQuantity} max={stock} disabled={soldOut} onChange={setQuantity} />
      </div>
      {!soldOut && effectiveQuantity >= stock ? (
        <p className="text-sm text-muted-foreground">{`That is all we have: the maximum is ${stock}.`}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" variant="cta" className="sm:flex-1" disabled={soldOut} aria-describedby={soldOut ? explanationId : undefined} onClick={addToCart}>
          {soldOut ? "Out of stock" : "Add to Cart"}
        </Button>
        <Button size="lg" variant="cta-outline" className="sm:flex-1" disabled={soldOut} aria-describedby={soldOut ? explanationId : undefined} onClick={buyNow}>
          Buy Now
        </Button>
      </div>

      {soldOut && info.explanation ? (
        <p id={explanationId} className="text-sm text-muted-foreground">
          {info.explanation}
        </p>
      ) : null}
      {result ? (
        <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-accent px-3 py-2 text-sm text-accent-foreground">
          <span>{result.text}</span>
          {result.success ? (
            <Link href="/cart" className="font-medium underline underline-offset-4">
              View cart
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
