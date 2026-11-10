import type { Metadata } from "next";

import { InventoryView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: inventory" };

export default function Page() {
  return <InventoryView />;
}
