import type { Metadata } from "next";

import { AdminReviewsView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: reviews" };

export default function Page() {
  return <AdminReviewsView />;
}
