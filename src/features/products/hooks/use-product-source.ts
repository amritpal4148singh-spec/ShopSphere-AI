import { useQuery } from "@tanstack/react-query";

import { fetchCatalog, searchProducts } from "@/services/products";

const CATALOG_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * The product set a discovery view filters over: the whole catalogue, or the API's search results
 * for a query. TanStack Query caches and de-duplicates both; a failed refetch keeps the last data.
 */
export function useProductSource(query: string) {
  return useQuery({
    queryKey: query ? ["products", "search", query.toLowerCase()] : ["products", "catalog"],
    queryFn: ({ signal }) => (query ? searchProducts(query, signal) : fetchCatalog(signal)),
    staleTime: CATALOG_STALE_TIME_MS,
  });
}
