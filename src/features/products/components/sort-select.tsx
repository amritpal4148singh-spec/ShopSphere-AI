import { SORT_OPTIONS } from "@/utils/discovery";
import type { SortKey } from "@/types/product";

interface SortSelectProps {
  value: SortKey;
  onChange: (sort: SortKey) => void;
}

export function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Sort by</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortKey)}
        className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
