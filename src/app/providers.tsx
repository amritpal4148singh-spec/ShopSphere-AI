"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { AccountSync } from "@/features/account";
import { CompareSync } from "@/features/compare";
import { AuthHydrator } from "@/features/auth";
import { CartSync } from "@/features/cart";
import { CheckoutSync } from "@/features/checkout";
import { RecommendationSync } from "@/features/recommendations";
import { ReviewsSync } from "@/features/reviews";
import { WishlistSync } from "@/features/wishlist";
import { createQueryClient } from "@/lib/query-client";

/**
 * Client-side providers. TanStack Query is provided here; Zustand stores are
 * module-level hooks (src/store) and need no provider. AuthHydrator restores the persisted session; CartSync, WishlistSync and CheckoutSync attach the cart, wishlist, checkout draft, orders and saved addresses to the shopper; RecommendationSync loads this device's viewing history; ReviewsSync loads the reviews written and moderated on this device.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydrator />
      <CartSync />
      <WishlistSync />
      <CheckoutSync />
      <RecommendationSync />
      <ReviewsSync />
      <AccountSync />
      <CompareSync />
      {children}
    </QueryClientProvider>
  );
}
