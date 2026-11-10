"use client";

import { useEffect } from "react";

import { ADDRESS_STORAGE_PREFIX, CHECKOUT_STORAGE_PREFIX } from "@/lib/checkout-storage";
import { ORDER_STORAGE_PREFIX } from "@/lib/order-storage";
import { useAddressStore } from "@/store/address-store";
import { useAuthStore } from "@/store/auth-store";
import { useCheckoutStore } from "@/store/checkout-store";
import { useOrdersStore } from "@/store/orders-store";

/**
 * Connects the checkout draft, the order history and the saved addresses to the signed-in customer, and
 * reloads them when another tab changes them. An expired session keeps the in-memory owner, so the draft is
 * still there when the customer signs back in (PRD MOD-06-001); it is also saved in storage on every change.
 */
export function CheckoutSync() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.session?.user.id ?? null);

  useEffect(() => {
    if (authStatus === "idle") return;
    const checkout = useCheckoutStore.getState();
    if (authStatus === "expired" && checkout.status === "ready" && checkout.ownerId !== null) return;

    useCheckoutStore.getState().switchOwner(userId);
    useOrdersStore.getState().switchOwner(userId);
    useAddressStore.getState().switchOwner(userId);
  }, [authStatus, userId]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      const key = event.key;
      if (key === null || key.startsWith(CHECKOUT_STORAGE_PREFIX)) useCheckoutStore.getState().reload();
      if (key === null || key.startsWith(ORDER_STORAGE_PREFIX)) useOrdersStore.getState().reload();
      if (key === null || key.startsWith(ADDRESS_STORAGE_PREFIX)) useAddressStore.getState().reload();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
