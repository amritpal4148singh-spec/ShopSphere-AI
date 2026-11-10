"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clampQuantity } from "@/utils/purchase";

interface QuantityStepperProps {
  value: number;
  /** Largest allowed quantity, usually the available stock. */
  max: number;
  onChange: (quantity: number) => void;
  min?: number;
  disabled?: boolean;
  label?: string;
  /** Called when a typed quantity had to be reduced (or raised) to fit [min, max], so the caller can explain why. */
  onClamp?: (requested: number, limit: number) => void;
}

/** Quantity control bounded to [min, max]. Typing is committed (and clamped) on blur or Enter. */
export function QuantityStepper({ value, max, onChange, min = 1, disabled = false, label = "Quantity", onClamp }: QuantityStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit(raw: string | null) {
    const parsed = Number.parseInt(raw ?? "", 10);
    const requested = Number.isNaN(parsed) ? value : parsed;
    const next = clampQuantity(requested, max, min);
    // onChange first: a caller that clears its message when the quantity changes must not erase the clamp notice.
    onChange(next);
    if (next !== requested) onClamp?.(requested, next);
    setDraft(null);
  }

  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(clampQuantity(value - 1, max, min))}
      >
        <Minus aria-hidden="true" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(draft);
          }
        }}
        className="h-10 w-14 rounded-lg border border-input bg-card text-center text-sm font-semibold focus-visible:border-primary disabled:opacity-50"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(clampQuantity(value + 1, max, min))}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}
