"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { POPULAR_SEARCHES } from "@/lib/popular-searches";
import { useRecentSearches } from "../hooks/use-recent-searches";

function searchHref(term: string): string {
  return `/search?q=${encodeURIComponent(term)}`;
}

/** The /search page with no query: recent and popular searches, no request fired (PRD edge case 5). */
export function SearchHome() {
  const { recent, add, clear, refresh } = useRecentSearches();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="page-title">Search</h1>
      <p className="mt-2 text-muted-foreground">Type in the search box above, or start with one of these.</p>

      {recent.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center gap-4">
            <h2 className="section-title">Recent searches</h2>
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={clear}>
              Clear history
            </Button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {recent.map((term) => (
              <li key={term}>
                <Link href={searchHref(term)} className="inline-block rounded-full border px-3 py-1.5 text-sm hover:bg-accent">
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="section-title">Popular searches</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {POPULAR_SEARCHES.map((term) => (
            <li key={term}>
              <Link
                href={searchHref(term)}
                onClick={() => add(term)}
                className="inline-block rounded-full border px-3 py-1.5 text-sm hover:bg-accent"
              >
                {term}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
