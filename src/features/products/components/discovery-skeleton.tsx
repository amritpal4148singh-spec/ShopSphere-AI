const SKELETON_CARDS = 12;

/** Layout-matching loading state (PRD section 16): toolbar, filter column, and a card grid. */
export function DiscoverySkeleton() {
  return (
    <div className="mt-6">
      <p role="status" className="sr-only">
        Loading products
      </p>
      <div aria-hidden="true">
        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
          <div className="hidden space-y-4 lg:block">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <li key={index} className="space-y-2 rounded-xl border bg-card shadow-surface p-3">
                <div className="aspect-square animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Suspense fallback for the discovery routes: page container, heading placeholder, then the skeleton. */
export function DiscoveryPageFallback() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="h-9 w-56 animate-pulse rounded-md bg-muted" />
      <DiscoverySkeleton />
    </div>
  );
}
