import type { Metadata } from "next";
import { Suspense } from "react";

import { DiscoveryPageFallback, ProductDiscovery } from "@/features/products";

export const metadata: Metadata = { title: "Shop" };

export default function ProductsPage() {
  return (
    <Suspense fallback={<DiscoveryPageFallback />}>
      <ProductDiscovery basePath="/products" />
    </Suspense>
  );
}
