import { Suspense } from "react";

import { DiscoveryPageFallback, ProductDiscovery } from "@/features/products";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <Suspense fallback={<DiscoveryPageFallback />}>
      <ProductDiscovery basePath={`/category/${slug}`} fixedCategory={slug} />
    </Suspense>
  );
}
