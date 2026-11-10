import type { Metadata } from "next";

import { CategoriesView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: categories" };

export default function Page() {
  return <CategoriesView />;
}
