import type { Metadata } from "next";

import { DashboardView } from "@/features/account";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="page-title">Dashboard</h1>
      <DashboardView />
    </section>
  );
}
