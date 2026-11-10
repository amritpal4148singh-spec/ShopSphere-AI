import type { Metadata } from "next";

import { ProductDetailView } from "@/features/products";
import { ProductPageRecommendations } from "@/features/recommendations";

export const metadata: Metadata = { title: "Product details" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // The route supplies the rails, so the products feature does not depend on the recommendations feature.
  return <ProductDetailView productId={id} recommendations={<ProductPageRecommendations productId={id} />} />;
}
