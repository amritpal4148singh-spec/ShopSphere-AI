"use client";

import { useEffect } from "react";

import { CART_STORAGE_PREFIX } from "@/lib/cart-storage";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";

/**
 * Connects the cart to who is shopping: the guest cart or the signed-in customer's cart, merging the
 * guest cart on sign-in (PRD 4.3). Also reloads the cart when another tab changes it (PRD edge case 26).
 */
export function CartSync() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const switchOwner = useCartStore((state) => state.switchOwner);
  const reload = useCartStore((state) => state.reload);

  useEffect(() => {
    if (authStatus === "idle") return;
    const { status, ownerId } = useCartStore.getState();
    // An expired session keeps showing the account cart until the customer signs in again.
    if (authStatus === "expired" && status === "ready" && ownerId !== null) return;
    switchOwner(userId);
  }, [authStatus, userId, switchOwner]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key.startsWith(CART_STORAGE_PREFIX)) reload();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [reload]);

  return null;
}
