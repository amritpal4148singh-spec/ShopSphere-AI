import type { Metadata } from "next";

import { WishlistView } from "@/features/wishlist";

export const metadata: Metadata = { title: "Wishlist" };

export default function WishlistPage() {
  return <WishlistView />;
}
