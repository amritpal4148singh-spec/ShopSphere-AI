import type { Metadata } from "next";

import { OrderConfirmation } from "@/features/orders";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function ConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrderConfirmation orderId={orderId} />;
}
