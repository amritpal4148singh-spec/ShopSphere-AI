import { cn } from "@/lib/utils";
import type { Availability } from "@/types/product";

const TEXT: Record<Availability, string> = { "in-stock": "In stock", "low-stock": "Low stock", "out-of-stock": "Out of stock" };

/** Stock state as text plus colour (never colour alone, PRD 14). */
export function StockBadge({ availability }: { availability: Availability }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", availability === "in-stock" && "bg-accent text-accent-foreground", availability === "low-stock" && "border-warning/40 bg-warning-soft text-warning", availability === "out-of-stock" && "border-destructive text-destructive")}>
      {TEXT[availability]}
    </span>
  );
}
