import { useCallback, useEffect, useState } from "react";

import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/lib/search-history";

/** Recent searches from local storage. Starts empty so server and first client render match. */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecentSearches());
  }, []);

  const refresh = useCallback(() => setRecent(getRecentSearches()), []);
  const add = useCallback((query: string) => setRecent(addRecentSearch(query)), []);
  const clear = useCallback(() => {
    clearRecentSearches();
    setRecent([]);
  }, []);

  return { recent, add, clear, refresh };
}
