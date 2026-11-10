"use client";

import { useEffect } from "react";

import { COMPARE_STORAGE_KEY } from "@/lib/compare-storage";
import { useCompareStore } from "@/store/compare-store";

/** Loads the session's comparison list after hydration and refreshes it when another tab changes it. */
export function CompareSync() {
  useEffect(() => {
    useCompareStore.getState().hydrate();
    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key === COMPARE_STORAGE_KEY) useCompareStore.getState().reload();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
  return null;
}
