"use client";

import { useSearchParams } from "next/navigation";

import { ProductDiscovery } from "@/features/products";
import { SearchHome } from "@/features/search";

/** Results page (reuses the discovery grid, filters and sorting) or, with no query, recent and popular searches. */
export function SearchView() {
  const query = (useSearchParams().get("q") ?? "").trim();
  return query ? <ProductDiscovery basePath="/search" /> : <SearchHome />;
}
