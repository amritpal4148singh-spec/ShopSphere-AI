import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3.5 text-sm shadow-[inset_0_1px_2px_rgb(20_19_43/0.05)] transition placeholder:text-muted-foreground hover:border-primary/60 focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_4px_rgb(180_35_24/0.16)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
