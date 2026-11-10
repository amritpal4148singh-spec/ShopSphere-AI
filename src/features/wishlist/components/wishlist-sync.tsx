"use client";

import { useEffect } from "react";

import { WISHLIST_STORAGE_PREFIX } from "@/lib/wishlist-storage";
import { useAuthStore } from "@/store/auth-store";
import { useWishlistStore } from "@/store/wishlist-store";

/** Connects the wishlist to who is shopping (guest: session only; customer: persisted) and keeps tabs in sync. */
export function WishlistSync() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const switchOwner = useWishlistStore((state) => state.switchOwner);
  const reload = useWishlistStore((state) => state.reload);

  useEffect(() => {
    if (authStatus === "idle") return;
    const { status, ownerId } = useWishlistStore.getState();
    if (authStatus === "expired" && status === "ready" && ownerId !== null) return;
    switchOwner(userId);
  }, [authStatus, userId, switchOwner]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key.startsWith(WISHLIST_STORAGE_PREFIX)) reload();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [reload]);

  return null;
}
