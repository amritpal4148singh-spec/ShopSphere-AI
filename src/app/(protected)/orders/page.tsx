import type { Metadata } from "next";

import { OrdersView } from "@/features/orders";

export const metadata: Metadata = { title: "Your orders" };

export default function OrdersPage() {
  return <OrdersView />;
}
