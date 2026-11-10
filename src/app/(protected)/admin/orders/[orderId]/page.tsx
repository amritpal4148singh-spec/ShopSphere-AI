import type { Metadata } from "next";

import { AdminOrderDetailView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: order" };

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <AdminOrderDetailView orderId={orderId} />;
}
