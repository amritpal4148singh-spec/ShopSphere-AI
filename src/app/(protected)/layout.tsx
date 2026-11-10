import type { ReactNode } from "react";

import { AuthGuard } from "@/features/auth";

/** Every route in this group requires a signed-in user (PRD section 11.1: checkout, dashboard, orders, admin). */
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
