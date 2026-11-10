import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  pressed: boolean;
  onToggle: () => void;
  /** The product's name, used to build an unambiguous accessible label. */
  name: string;
  className?: string;
}

/** Wishlist heart toggle. `aria-pressed` announces the state; the label names the product. */
export function FavoriteButton({ pressed, onToggle, name, className }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={pressed ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      onClick={onToggle}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full border border-border/70 bg-card/90 shadow-sm backdrop-blur transition duration-200 hover:scale-110 hover:border-cta hover:bg-card active:scale-95 motion-reduce:hover:scale-100",
        pressed ? "text-sale" : "text-foreground",
        className,
      )}
    >
      <Heart aria-hidden="true" className={cn("size-5 transition-transform duration-300", pressed && "animate-pop fill-current")} />
    </button>
  );
}
