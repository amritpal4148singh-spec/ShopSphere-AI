import Link from "next/link";
import { AlertCircle, SearchX, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/products";
import type { ActiveFilter } from "@/utils/discovery";

export function describeError(error: unknown): { title: string; message: string; offline: boolean } {
  if (error instanceof ApiError) {
    if (error.kind === "network") {
      return {
        title: "You appear to be offline",
        message: "We could not reach the product service. Check your connection and try again.",
        offline: true,
      };
    }
    if (error.kind === "timeout") {
      return {
        title: "The product service is taking too long",
        message: "The request timed out. Please try again in a moment.",
        offline: false,
      };
    }
    if (error.kind === "parse") {
      return {
        title: "We received unexpected data",
        message: "The product service sent a response we could not read. Please try again.",
        offline: false,
      };
    }
  }
  return {
    title: "We could not load products",
    message: "Something went wrong. Please try again.",
    offline: false,
  };
}

/** Full failure state with a recovery action (PRD section 16: Error and Network Failure). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { title, message, offline } = describeError(error);
  const Icon = offline ? WifiOff : AlertCircle;

  return (
    <div role="alert" className="mt-8 flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
      <Icon aria-hidden="true" className="size-8 text-destructive" />
      <h2 className="section-title">{title}</h2>
      <p className="max-w-md text-muted-foreground">{message}</p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

/** Shown when a refresh fails but earlier data is still on screen (PRD edge case 3). */
export function RetryBanner({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { offline } = describeError(error);

  return (
    <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-accent px-4 py-3 text-sm">
      <p>
        {offline
          ? "You appear to be offline. Showing the products loaded earlier."
          : "We could not refresh the products. Showing the products loaded earlier."}
      </p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** No product matches the active filters (PRD MOD-02-002): names the filters and offers a one-click clear. */
export function NoMatches({ filters, onClear }: { filters: ActiveFilter[]; onClear: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
      <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="section-title">No products match your filters</h2>
      {filters.length > 0 ? (
        <>
          <p className="text-muted-foreground">These filters produced no results:</p>
          <ul aria-label="Filters with no results" className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <li key={JSON.stringify(filter.key)} className="rounded-full border bg-accent px-3 py-1 text-sm">
                {filter.label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Button onClick={onClear}>Clear Filters</Button>
    </div>
  );
}

/** A search that found nothing (PRD edge case 6): alternatives to try, never a dead end. */
export function NoSearchResults({ query, suggestions }: { query: string; suggestions: string[] }) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
      <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="section-title">{`No results for “${query}”`}</h2>
      <p className="max-w-md text-muted-foreground">
        Check the spelling, try a more general word, or browse the whole catalogue.
      </p>
      {suggestions.length > 0 ? (
        <div>
          <p className="text-sm font-medium">Did you mean:</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((term) => (
              <li key={term}>
                <Link
                  href={`/search?q=${encodeURIComponent(term)}`}
                  className="inline-block rounded-full border px-3 py-1 text-sm hover:bg-accent"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button asChild variant="outline">
        <Link href="/products">Browse all products</Link>
      </Button>
    </div>
  );
}

export function CategoryNotFound() {
  return (
    <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border bg-card shadow-surface p-6">
      <SearchX aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="section-title">This category has no products</h2>
      <p className="max-w-md text-muted-foreground">The category may have moved or been removed.</p>
      <Button asChild>
        <Link href="/products">Browse all products</Link>
      </Button>
    </div>
  );
}
