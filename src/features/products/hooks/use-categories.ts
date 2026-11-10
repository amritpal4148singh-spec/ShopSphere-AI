import { useQuery } from "@tanstack/react-query";

import { fetchCategories } from "@/services/products";

const CATEGORIES_STALE_TIME_MS = 60 * 60 * 1000;

export function useCategories(enabled = true) {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: CATEGORIES_STALE_TIME_MS,
    enabled,
  });
}
