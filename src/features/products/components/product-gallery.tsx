"use client";

import { useState, type MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { ProductImage } from "./product-image";

interface ProductGalleryProps {
  images: string[];
  title: string;
}

const MAIN_SIZES = "(min-width: 1024px) 50vw, 100vw";

/**
 * Main image with thumbnail navigation and zoom on hover (PRD 5.4 allows zoom-on-hover or a lightbox).
 * Zoom is pure CSS and only applies on devices that support hover, so touch screens are unaffected.
 */
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const current = images[Math.min(index, Math.max(images.length - 1, 0))] ?? null;

  function trackPointer(event: MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    event.currentTarget.style.setProperty("--zoom-x", `${((event.clientX - box.left) / box.width) * 100}%`);
    event.currentTarget.style.setProperty("--zoom-y", `${((event.clientY - box.top) / box.height) * 100}%`);
  }

  return (
    <div>
      <div
        data-testid="gallery-main"
        onMouseMove={trackPointer}
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_50%_40%,var(--surface),var(--muted))] shadow-surface"
      >
        <div className="size-full transition-transform duration-200 [transform-origin:var(--zoom-x,50%)_var(--zoom-y,50%)] group-hover:scale-[1.8]">
          <ProductImage key={current ?? "none"} src={current} alt={title} sizes={MAIN_SIZES} priority />
        </div>
      </div>

      {images.length > 1 ? (
        <ul aria-label="Product images" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, position) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                aria-label={`Show image ${position + 1} of ${images.length}`}
                aria-current={position === index ? "true" : undefined}
                onClick={() => setIndex(position)}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-md border bg-muted sm:size-20",
                  position === index ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100",
                )}
              >
                <ProductImage src={src} sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
