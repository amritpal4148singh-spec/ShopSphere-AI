import type { Metadata } from "next";

import { CartView } from "@/features/cart";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return <CartView />;
}
