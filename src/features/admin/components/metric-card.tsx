import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** One headline number. `tag` says where it comes from ("Simulated", "Local Analytics") so it is never mistaken for live data. */
export function MetricCard({ label, value, tag, note, className }: { label: string; value: ReactNode; tag?: string; note?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-surface p-4", className)}>
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {label}
        {tag ? <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">{tag}</span> : null}
      </p>
      <p className="mt-1 font-display text-3xl font-semibold tracking-tight" data-testid={`metric-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
