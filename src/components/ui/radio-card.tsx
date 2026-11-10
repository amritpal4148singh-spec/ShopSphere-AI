import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: ReactNode;
  /** Right-aligned text such as a price. */
  extra?: ReactNode;
  disabled?: boolean;
}

/** A bordered native radio option. The whole card is the label, and the checked state is not colour-only. */
export function RadioCard({ name, value, checked, onChange, title, description, extra, disabled = false }: RadioCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition duration-200 hover:border-primary/50 hover:shadow-surface",
        "has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:shadow-[0_0_0_1px_var(--primary)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} disabled={disabled} className="mt-1 size-4 shrink-0 accent-primary" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {description ? <span className="block text-sm text-muted-foreground">{description}</span> : null}
      </span>
      {extra ? <span className="shrink-0 font-medium">{extra}</span> : null}
    </label>
  );
}
