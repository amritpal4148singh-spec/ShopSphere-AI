"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/store/wishlist-store";

/** Header wishlist icon with the saved-item count. */
export function WishlistLink({ className }: { className?: string }) {
  const count = useWishlistStore((state) => state.items.length);
  const noun = count === 1 ? "item" : "items";

  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist, ${count} ${noun}`}
      className={cn("relative inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground", className)}
    >
      <Heart aria-hidden="true" className="size-5" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex min-w-5 animate-pop items-center justify-center rounded-full bg-cta px-1 text-[0.7rem] font-bold leading-5 text-cta-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
