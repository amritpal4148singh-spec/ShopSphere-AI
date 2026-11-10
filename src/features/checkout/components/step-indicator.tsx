import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CheckoutStep } from "@/types/checkout";
import { STEP_LABELS } from "@/utils/checkout";

interface StepIndicatorProps {
  current: CheckoutStep;
  /** Furthest step reached; steps up to here can be revisited. */
  maxStep: CheckoutStep;
  onSelect: (step: CheckoutStep) => void;
}

/** The six checkout steps (PRD 5.6). Completed steps can be revisited; the last step is the confirmation page. */
export function StepIndicator({ current, maxStep, onSelect }: StepIndicatorProps) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex flex-wrap gap-x-2 gap-y-2 text-sm">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1;
          const isConfirmation = number === 6;
          const isCurrent = number === current;
          const done = number < current;
          const reachable = !isConfirmation && number <= maxStep && !isCurrent;

          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                )}
              >
                {done ? <Check className="size-3.5" /> : number}
              </span>
              <span>{label}</span>
              {done ? <span className="sr-only"> (completed)</span> : null}
            </>
          );

          return (
            <li key={label} aria-current={isCurrent ? "step" : undefined} className="flex items-center gap-2">
              {reachable ? (
                <button type="button" onClick={() => onSelect(number as CheckoutStep)} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent">
                  {content}
                </button>
              ) : (
                <span className={cn("flex items-center gap-2 px-1 py-1", !isCurrent && !done && "text-muted-foreground", isCurrent && "font-semibold")}>{content}</span>
              )}
              {number < STEP_LABELS.length ? <span aria-hidden="true" className="text-muted-foreground">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
