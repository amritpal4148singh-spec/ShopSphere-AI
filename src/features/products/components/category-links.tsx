import Link from "next/link";

import type { Category } from "@/types/product";
import { categoryIcon } from "./category-icons";

/** Entry points to the category browsing pages (PRD 5.2). */
export function CategoryLinks({ categories }: { categories: readonly Category[] }) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Browse categories" className="mt-4">
      {/* Vertical padding leaves room for the focus ring, which an overflow container would otherwise clip. */}
      <ul className="scroll-fade flex snap-x gap-2.5 overflow-x-auto scroll-smooth py-2">
        {categories.map((category) => {
          const Icon = categoryIcon(category.slug);
          return (
            <li key={category.slug} className="shrink-0 snap-start">
              <Link
                href={`/category/${category.slug}`}
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card py-2 pl-2.5 pr-4 text-sm font-semibold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md focus-visible:border-primary focus-visible:bg-primary focus-visible:text-primary-foreground motion-reduce:hover:translate-y-0"
              >
                <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground transition-colors duration-200 group-hover:bg-primary-foreground/15 group-hover:text-primary-foreground group-focus-visible:bg-primary-foreground/15 group-focus-visible:text-primary-foreground">
                  <Icon className="size-4" />
                </span>
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
