"use client";

import { useEffect } from "react";

import { REVIEW_STORAGE_KEY } from "@/lib/review-storage";
import { useReviewsStore } from "@/store/reviews-store";

/** Loads this device's reviews after mount (so server and first client render match) and follows other tabs. */
export function ReviewsSync() {
  const hydrate = useReviewsStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();

    function handleStorage(event: StorageEvent) {
      if (event.key === null || event.key === REVIEW_STORAGE_KEY) useReviewsStore.getState().reload();
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [hydrate]);

  return null;
}
