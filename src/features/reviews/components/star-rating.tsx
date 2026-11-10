import { Star } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarDisplayProps {
  rating: number;
  className?: string;
  /** When the number is written out next to the stars, the stars are decoration and get no label. */
  decorative?: boolean;
}

/** Read-only stars. The meaning is in the label, not in the colour (PRD 14). */
export function StarDisplay({ rating, className, decorative = false }: StarDisplayProps) {
  const rounded = Math.round(rating);
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `Rated ${Number.isInteger(rating) ? rating : rating.toFixed(1)} out of 5` })}
    >
      {STARS.map((star) => (
        <Star key={star} aria-hidden="true" className={cn("size-4", star <= rounded ? "fill-current text-star" : "text-muted-foreground/50")} />
      ))}
    </span>
  );
}

interface StarInputProps {
  value: number | null;
  onChange: (value: number) => void;
  error?: string | undefined;
}

/** A 1-5 star chooser built on native radio buttons, so arrow keys, focus and screen readers work as expected. */
export function StarInput({ value, onChange, error }: StarInputProps) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="space-y-1.5">
      <legend className="text-sm font-medium">Your rating</legend>
      <div className="flex items-center gap-1">
        {STARS.map((star) => (
          <label key={star} className="relative cursor-pointer rounded-md p-1">
            <input
              type="radio"
              name={name}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="peer sr-only"
              aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
            />
            <Star
              aria-hidden="true"
              className={cn(
                "size-7 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                value !== null && star <= value ? "fill-current text-star" : "text-muted-foreground/60",
              )}
            />
          </label>
        ))}
        <span className="ml-2 text-sm text-muted-foreground" aria-hidden="true">
          {value === null ? "Select a rating" : `${value} of 5`}
        </span>
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
