import type { Metadata } from "next";
import { Suspense } from "react";

import { DiscoveryPageFallback } from "@/features/products";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <Suspense fallback={<DiscoveryPageFallback />}>
      <SearchView />
    </Suspense>
  );
}
