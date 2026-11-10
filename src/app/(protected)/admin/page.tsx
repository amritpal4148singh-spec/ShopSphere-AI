import type { Metadata } from "next";

import { OverviewView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin dashboard" };

export default function Page() {
  return <OverviewView />;
}
