"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";
import { useProfileStore } from "@/store/profile-store";
import { PROFILE_STORAGE_PREFIX } from "@/lib/profile-storage";

/** Attaches the saved profile to the signed-in customer and reloads it when another tab changes it. */
export function AccountSync() {
  const authStatus = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.session?.user.id ?? null);

  useEffect(() => {
    if (authStatus === "idle") return;
    useProfileStore.getState().switchOwner(userId);
  }, [authStatus, userId]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key.startsWith(PROFILE_STORAGE_PREFIX)) useProfileStore.getState().reload();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
