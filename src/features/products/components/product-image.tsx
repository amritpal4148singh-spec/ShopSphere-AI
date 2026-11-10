"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface ProductImageProps {
  src: string | null;
  sizes: string;
  /** Empty by default: card thumbnails are decorative next to their title link. */
  alt?: string;
  priority?: boolean;
  className?: string;
}

/** Product image with a graceful placeholder (PRD edge case 20: never a broken-image icon). */
export function ProductImage({ src, sizes, alt = "", priority = false, className }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        data-testid="image-placeholder"
        {...(alt ? { role: "img", "aria-label": `${alt} (image unavailable)` } : { "aria-hidden": true })}
        className="flex size-full items-center justify-center bg-muted text-muted-foreground"
      >
        <ImageOff aria-hidden="true" className="size-8" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn("object-contain p-2", className)}
      onError={() => setFailed(true)}
    />
  );
}
