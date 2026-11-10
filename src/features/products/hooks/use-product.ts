import { useQuery } from "@tanstack/react-query";

import { ApiError, fetchProduct } from "@/services/products";

const PRODUCT_STALE_TIME_MS = 5 * 60 * 1000;

/** One product's detail. A 404 (product removed) is not retried; the last good data survives a failed refresh. */
export function useProduct(id: number | null) {
  return useQuery({
    queryKey: ["product", id],
    queryFn: ({ signal }) => fetchProduct(id as number, signal),
    enabled: id !== null,
    staleTime: PRODUCT_STALE_TIME_MS,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  });
}
