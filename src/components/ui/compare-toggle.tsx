import { Check, Scale } from "lucide-react";

import { cn } from "@/lib/utils";

interface CompareToggleProps {
  pressed: boolean;
  /** True when four products are already selected and this one is not among them. */
  limitReached: boolean;
  onToggle: () => void;
  name: string;
  className?: string;
}

/** "Compare" toggle for a product card. `aria-pressed` announces the state; the limit is explained, not just a dead button. */
export function CompareToggle({ pressed, limitReached, onToggle, name, className }: CompareToggleProps) {
  const blocked = limitReached && !pressed;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={blocked || undefined}
      aria-label={pressed ? `Remove ${name} from comparison` : blocked ? `Comparison is full (4 products). Remove one to compare ${name}` : `Compare ${name}`}
      title={blocked ? "You can compare up to 4 products" : undefined}
      // Still clickable at the limit: the store refuses the product and the tray explains why.
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pressed ? "border-gold-edge bg-secondary text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
        blocked && "cursor-not-allowed opacity-60 hover:border-border hover:text-muted-foreground",
        className,
      )}
    >
      {pressed ? <Check aria-hidden="true" className="size-3.5" /> : <Scale aria-hidden="true" className="size-3.5" />}
      {pressed ? "Added to compare" : "Compare"}
    </button>
  );
}
