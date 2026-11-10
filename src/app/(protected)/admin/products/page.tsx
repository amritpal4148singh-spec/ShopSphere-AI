import type { Metadata } from "next";

import { ProductsView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: products" };

export default function Page() {
  return <ProductsView />;
}
