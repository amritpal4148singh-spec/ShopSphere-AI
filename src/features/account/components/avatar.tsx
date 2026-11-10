import Image from "next/image";

import { cn } from "@/lib/utils";
import { initialsOf } from "@/utils/profile";

interface AvatarProps {
  name: string;
  src: string | null;
  className?: string;
}

/** The customer's picture, or a champagne-edged initials badge. Decorative next to the name, so the image has empty alt. */
export function Avatar({ name, src, className }: AvatarProps) {
  return (
    <span
      className={cn("relative inline-flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold-edge bg-secondary font-display text-2xl font-semibold text-secondary-foreground", className)}
      data-testid="avatar"
    >
      {src ? <Image src={src} alt="" width={192} height={192} unoptimized className="size-full object-cover" /> : <span aria-hidden="true">{initialsOf(name)}</span>}
    </span>
  );
}
