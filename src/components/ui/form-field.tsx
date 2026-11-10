import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/input";

interface FormFieldProps extends Omit<React.ComponentProps<typeof Input>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Accessible labelled input. The error is tied to the input via aria-describedby and is
 * conveyed with an icon and text, not colour alone (PRD section 14).
 */
function FormField({ label, error, hint, ...inputProps }: FormFieldProps) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...inputProps} />
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
