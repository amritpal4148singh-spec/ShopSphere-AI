import type { Metadata } from "next";

import { AdminOrdersView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: orders" };

export default function Page() {
  return <AdminOrdersView />;
}
