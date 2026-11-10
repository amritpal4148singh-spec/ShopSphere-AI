"use client";

import { useEffect } from "react";

import { VIEWED_STORAGE_KEY } from "@/lib/viewed-storage";
import { useViewedStore } from "@/store/viewed-store";

/** Loads the device's viewing history after mount (so server and first client render match) and follows other tabs. */
export function RecommendationSync() {
  const hydrate = useViewedStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();

    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key === VIEWED_STORAGE_KEY) hydrate();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hydrate]);

  return null;
}
