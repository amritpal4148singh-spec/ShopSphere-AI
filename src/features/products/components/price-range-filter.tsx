"use client";

import { useEffect, useRef, useState } from "react";

import { formatInr } from "@/lib/currency";
import type { PriceBounds } from "@/utils/discovery";

export const PRICE_COMMIT_DELAY_MS = 300;
const PRICE_STEP = 100;

interface PriceRangeFilterProps {
  bounds: PriceBounds;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  /** Called once the sliders settle. A value at its bound means "no limit" and is passed as undefined. */
  onCommit: (minPrice: number | undefined, maxPrice: number | undefined) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Two sliders that cannot cross (PRD edge case 7: never an invalid range). Dragging updates the
 * display immediately; the URL/filters update after the sliders settle.
 */
export function PriceRangeFilter({ bounds, minPrice, maxPrice, onCommit }: PriceRangeFilterProps) {
  const effectiveMin = clamp(minPrice ?? bounds.min, bounds.min, bounds.max);
  const effectiveMax = clamp(maxPrice ?? bounds.max, bounds.min, bounds.max);

  const [local, setLocal] = useState({ min: effectiveMin, max: effectiveMax });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The delayed commit must call the *latest* onCommit. A callback captured when the slider moved would
  // build the next URL from older filter state and overwrite anything changed in the meantime (for example
  // the rating chosen within the 300 ms delay).
  const latestOnCommit = useRef(onCommit);
  useEffect(() => {
    latestOnCommit.current = onCommit;
  });

  useEffect(() => {
    setLocal({ min: effectiveMin, max: effectiveMax });
  }, [effectiveMin, effectiveMax]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function schedule(next: { min: number; max: number }) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      latestOnCommit.current(
        next.min <= bounds.min ? undefined : next.min,
        next.max >= bounds.max ? undefined : next.max,
      );
    }, PRICE_COMMIT_DELAY_MS);
  }

  const disabled = bounds.max <= bounds.min;

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {`${formatInr(local.min)} to ${formatInr(local.max)}`}
      </p>
      <input
        type="range"
        aria-label="Minimum price"
        min={bounds.min}
        max={bounds.max}
        step={PRICE_STEP}
        value={local.min}
        disabled={disabled}
        className="w-full accent-primary"
        onChange={(event) => {
          const next = { min: Math.min(Number(event.target.value), local.max), max: local.max };
          setLocal(next);
          schedule(next);
        }}
      />
      <input
        type="range"
        aria-label="Maximum price"
        min={bounds.min}
        max={bounds.max}
        step={PRICE_STEP}
        value={local.max}
        disabled={disabled}
        className="w-full accent-primary"
        onChange={(event) => {
          const next = { min: local.min, max: Math.max(Number(event.target.value), local.min) };
          setLocal(next);
          schedule(next);
        }}
      />
    </div>
  );
}
