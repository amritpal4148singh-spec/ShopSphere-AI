import { FlaskConical } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Marks an administrator action as a local simulation (PRD 4.2 "Data Write Policy"): it is saved in this
 * browser's storage only and is not a write to a real data layer. Text and icon, not colour alone.
 */
export function LocalBadge({ className, children = "Local simulation" }: { className?: string; children?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning", className)}>
      <FlaskConical aria-hidden="true" className="size-3" />
      {children}
    </span>
  );
}
