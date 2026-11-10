import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Deep navy: the brand's primary action (ivory label, 14:1). */
        default: "bg-primary text-primary-foreground hover:bg-primary-deep",
        /**
         * Champagne: the shopping call to action (Add to Cart, Buy Now, Browse products, Checkout). Navy label (8:1). The
         * bronze edge gives the button a 3:1+ boundary on ivory, cream and sand, where the gold fill alone is only 2:1.
         */
        cta: "border border-gold-edge bg-cta font-bold text-cta-foreground shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--gold-edge)_70%,transparent)] hover:bg-cta-hover active:bg-cta-press",
        /** The quieter sibling of `cta`, for a second action beside it (Buy Now). */
        "cta-outline": "border-2 border-gold-edge bg-transparent font-bold text-foreground hover:bg-cta hover:text-cta-foreground active:bg-cta-press",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-card text-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
