import type { Metadata } from "next";

import { CompareView } from "@/features/compare";

export const metadata: Metadata = { title: "Compare products" };

export default function ComparePage() {
  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="page-title">Compare products</h1>
      <p className="mt-3 text-muted-foreground">Up to four products side by side. Differences are marked, and the best value in each row is highlighted.</p>
      <CompareView />
    </section>
  );
}
