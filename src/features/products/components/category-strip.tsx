"use client";

import { useCategories } from "../hooks/use-categories";
import { CategoryLinks } from "./category-links";

/** Holds the strip's height while categories load, so the page does not jump when they arrive. */
function CategoryStripSkeleton() {
  return (
    <div aria-hidden="true" className="mt-4 flex gap-2.5 overflow-hidden py-2">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="h-11 w-32 shrink-0 animate-pulse rounded-full bg-muted" />
      ))}
    </div>
  );
}

/** Category navigation for the homepage. Shows a placeholder while loading, and nothing if categories cannot load. */
export function CategoryStrip() {
  const categories = useCategories();
  if (categories.isPending) return <CategoryStripSkeleton />;
  return categories.data && categories.data.length > 0 ? <CategoryLinks categories={categories.data} /> : null;
}
