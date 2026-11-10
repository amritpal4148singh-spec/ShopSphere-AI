import type { Metadata } from "next";

import { NewProductView } from "@/features/admin";

export const metadata: Metadata = { title: "Admin: add product" };

export default function Page() {
  return <NewProductView />;
}
