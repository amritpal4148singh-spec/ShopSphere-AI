"use client";

import { useEffect } from "react";

import { SESSION_STORAGE_KEY } from "@/services/auth";
import { useAuthStore } from "@/store/auth-store";

/** Restores the persisted session after mount and keeps tabs in sync (sign-in/out in another tab). */
export function AuthHydrator() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();

    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key === SESSION_STORAGE_KEY) hydrate();
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hydrate]);

  return null;
}
