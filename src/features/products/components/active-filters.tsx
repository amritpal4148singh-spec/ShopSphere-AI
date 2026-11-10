import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ActiveFilter, FilterKey } from "@/utils/discovery";

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onRemove: (key: FilterKey) => void;
  onClearAll: () => void;
}

/** Removable chips for every active filter (PRD MOD-02-001: active filter chips are visible). */
export function ActiveFilters({ filters, onRemove, onClearAll }: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <ul aria-label="Active filters" className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <li key={JSON.stringify(filter.key)}>
            <button
              type="button"
              aria-label={`Remove filter: ${filter.label}`}
              onClick={() => onRemove(filter.key)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-accent px-3 py-1 text-sm text-accent-foreground transition-colors hover:bg-secondary"
            >
              {filter.label}
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}
