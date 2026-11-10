"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { ON_SALE_MIN_DISCOUNT, type PriceBounds } from "@/utils/discovery";
import type { AvailabilityFilter, DiscoveryState } from "@/types/product";
import { PriceRangeFilter } from "./price-range-filter";

interface FilterPanelProps {
  state: DiscoveryState;
  bounds: PriceBounds;
  brands: string[];
  categories: Array<{ slug: string; name: string }>;
  showCategories: boolean;
  hasActiveFilters: boolean;
  onChange: (patch: Partial<DiscoveryState>) => void;
  onClear: () => void;
}

const RATING_OPTIONS = [4, 3, 2] as const;
const AVAILABILITY_OPTIONS: ReadonlyArray<{ value: AvailabilityFilter; label: string }> = [
  { value: "any", label: "Any" },
  { value: "in", label: "In stock" },
  { value: "out", label: "Out of stock" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function CheckboxList({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="border-t pt-4">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FilterPanel({
  state,
  bounds,
  brands,
  categories,
  showCategories,
  hasActiveFilters,
  onChange,
  onClear,
}: FilterPanelProps) {
  const groupId = useId();

  return (
    <form aria-label="Filters" onSubmit={(event) => event.preventDefault()} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Filters</h2>
        {hasActiveFilters ? (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <fieldset className="border-t pt-4">
        <legend className="text-sm font-semibold">Price</legend>
        <div className="mt-2">
          <PriceRangeFilter
            bounds={bounds}
            minPrice={state.minPrice}
            maxPrice={state.maxPrice}
            onCommit={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })}
          />
        </div>
      </fieldset>

      <fieldset className="border-t pt-4">
        <legend className="text-sm font-semibold">Minimum rating</legend>
        <div className="mt-2 space-y-1">
          <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <input
              type="radio"
              name={`${groupId}-rating`}
              className="size-4 accent-primary"
              checked={state.minRating === undefined}
              onChange={() => onChange({ minRating: undefined })}
            />
            Any rating
          </label>
          {RATING_OPTIONS.map((rating) => (
            <label key={rating} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input
                type="radio"
                name={`${groupId}-rating`}
                className="size-4 accent-primary"
                checked={state.minRating === rating}
                onChange={() => onChange({ minRating: rating })}
              />
              {`${rating} stars and up`}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t pt-4">
        <legend className="text-sm font-semibold">Availability</legend>
        <div className="mt-2 space-y-1">
          {AVAILABILITY_OPTIONS.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input
                type="radio"
                name={`${groupId}-availability`}
                className="size-4 accent-primary"
                checked={state.availability === option.value}
                onChange={() => onChange({ availability: option.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t pt-4">
        <legend className="text-sm font-semibold">Deals</legend>
        <label className="mt-2 flex cursor-pointer items-center gap-2 py-1 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={state.onSale}
            onChange={(event) => onChange({ onSale: event.target.checked })}
          />
          {`On sale (${ON_SALE_MIN_DISCOUNT}% off or more)`}
        </label>
      </fieldset>

      {showCategories && categories.length > 1 ? (
        <CheckboxList
          legend="Category"
          options={categories.map((category) => ({ value: category.slug, label: category.name }))}
          selected={state.categories}
          onToggle={(slug) => onChange({ categories: toggle(state.categories, slug) })}
        />
      ) : null}

      {brands.length > 0 ? (
        <CheckboxList
          legend="Brand"
          options={brands.map((brand) => ({ value: brand, label: brand }))}
          selected={state.brands}
          onToggle={(brand) => onChange({ brands: toggle(state.brands, brand) })}
        />
      ) : null}
    </form>
  );
}
