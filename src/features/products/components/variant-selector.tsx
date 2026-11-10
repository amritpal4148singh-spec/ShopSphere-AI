import { useId } from "react";

import { cn } from "@/lib/utils";
import type { VariantGroup } from "@/types/product";

interface VariantSelectorProps {
  group: VariantGroup;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Native radio group. Sold-out options are visually disabled (struck through, muted) and announced as out of
 * stock, but stay selectable so the shopper can see why they cannot buy them (PRD MOD-04-001).
 */
export function VariantSelector({ group, selectedId, onSelect }: VariantSelectorProps) {
  const name = useId();
  const selected = group.options.find((option) => option.id === selectedId);

  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {`${group.label}: `}
        <span className="font-normal text-muted-foreground">{selected?.label ?? "Choose an option"}</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {group.options.map((option) => {
          const soldOut = option.stock <= 0;
          return (
            <label key={option.id} className="relative">
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={option.id === selectedId}
                onChange={() => onSelect(option.id)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex min-w-12 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm transition-colors",
                  "peer-checked:border-primary peer-checked:bg-accent peer-checked:text-accent-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                  soldOut ? "text-muted-foreground line-through opacity-60" : "hover:bg-accent/60",
                )}
              >
                {option.label}
                {soldOut ? <span className="sr-only"> (out of stock)</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
