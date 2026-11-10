import type { ReactNode } from "react";

import { AdminShell } from "@/features/admin";
import { AuthGuard } from "@/features/auth";

/** Administrators only (PRD 4.3, 11.1). Every admin screen sits inside the shell that carries the local-simulation notice. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard requiredRole="admin">
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
