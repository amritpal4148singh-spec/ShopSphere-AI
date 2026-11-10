import { useQuery } from "@tanstack/react-query";

import { fetchSuggestions } from "@/services/products";

const SUGGESTIONS_STALE_TIME_MS = 5 * 60 * 1000;

/** Live product suggestions. Pass an already-debounced query; `enabled` gates the request. */
export function useSuggestions(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["suggestions", query.toLowerCase()],
    queryFn: ({ signal }) => fetchSuggestions(query, signal),
    enabled: enabled && query.length > 0,
    staleTime: SUGGESTIONS_STALE_TIME_MS,
    retry: false,
  });
}
