import type { Metadata } from "next";

import { AnalyticsView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: analytics" };

export default function Page() {
  return <AnalyticsView />;
}
