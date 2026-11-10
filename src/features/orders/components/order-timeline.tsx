import { Check } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimelineStage } from "@/types/order";

const STATE_TEXT = { completed: "Completed", current: "Current stage", upcoming: "Upcoming" } as const;

/**
 * Six-stage order tracking (PRD 5.8): completed stages with timestamps, the current stage, and upcoming stages.
 * State is conveyed by text and an icon, not colour alone. Vertical so it works at every width.
 */
export function OrderTimeline({ stages }: { stages: TimelineStage[] }) {
  return (
    <ol aria-label="Order tracking" className="space-y-0">
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        return (
          <li key={stage.status} aria-current={stage.state === "current" ? "step" : undefined} data-state={stage.state} className="relative flex gap-4 pb-6 last:pb-0">
            {!last ? (
              <span aria-hidden="true" className={cn("absolute left-[0.8125rem] top-7 h-[calc(100%-1.75rem)] w-0.5", stage.state === "completed" ? "bg-primary" : "bg-border")} />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-background",
                stage.state === "completed" && "border-primary bg-primary text-primary-foreground",
                stage.state === "current" && "border-primary",
                stage.state === "upcoming" && "border-border",
              )}
            >
              {stage.state === "completed" ? <Check className="size-4" /> : stage.state === "current" ? <span className="size-2.5 rounded-full bg-primary" /> : null}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={cn("font-medium", stage.state === "upcoming" && "text-muted-foreground")}>
                {stage.label}
                <span className="sr-only">{`: ${STATE_TEXT[stage.state]}`}</span>
              </p>
              <p className="text-sm text-muted-foreground">{stage.at !== null ? formatDateTime(stage.at) : "Upcoming"}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
