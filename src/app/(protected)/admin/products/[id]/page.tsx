import type { Metadata } from "next";

import { EditProductView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: product" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditProductView productId={id} />;
}
