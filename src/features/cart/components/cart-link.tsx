"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { getItemCount } from "@/utils/cart";

/** Header cart icon with the item count. The count is announced politely when it changes (PRD section 14). */
export function CartLink({ className }: { className?: string }) {
  const ready = useCartStore((state) => state.status === "ready");
  const count = useCartStore((state) => getItemCount(state.items));
  const noun = count === 1 ? "item" : "items";

  return (
    <>
      <Link
        href="/cart"
        aria-label={`Cart, ${count} ${noun}`}
        className={cn("relative inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground", className)}
      >
        <ShoppingCart aria-hidden="true" className="size-5" />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-0.5 top-0.5 flex min-w-5 animate-pop items-center justify-center rounded-full bg-cta px-1 text-[0.7rem] font-bold leading-5 text-cta-foreground"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
      <span role="status" className="sr-only">
        {ready ? `${count} ${noun} in cart` : ""}
      </span>
    </>
  );
}
