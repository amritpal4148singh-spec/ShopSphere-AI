import type { Metadata } from "next";

import { OrderDetailView } from "@/features/orders";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderDetailView orderId={orderId} />;
}
