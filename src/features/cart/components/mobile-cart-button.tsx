"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";

import { useCartStore } from "@/store/cart-store";
import { getItemCount } from "@/utils/cart";

/**
 * A thumb-reachable cart shortcut for phones (PRD 15: bottom-accessible cart on mobile). It sits beside the assistant
 * launcher, shows only below 640px, and hides on the cart and checkout pages where it would be redundant.
 */
export function MobileCartButton() {
  const count = useCartStore((state) => getItemCount(state.items));
  const ready = useCartStore((state) => state.status === "ready");
  const pathname = usePathname();
  if (!ready || pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return null;

  return (
    <Link
      href="/cart"
      aria-label={`Shopping bag, ${count} ${count === 1 ? "item" : "items"}`}
      className="fixed bottom-4 right-[5.25rem] z-30 inline-flex size-12 items-center justify-center rounded-full border border-gold-edge bg-card text-foreground shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden pb-0 mb-[env(safe-area-inset-bottom)]"
    >
      <ShoppingBag aria-hidden="true" className="size-5" />
      {count > 0 ? (
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-cta px-1 text-[0.7rem] font-bold text-cta-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
