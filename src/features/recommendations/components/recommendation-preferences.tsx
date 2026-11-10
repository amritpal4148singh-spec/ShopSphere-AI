"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCatalog } from "@/features/products";
import { formatInr } from "@/lib/currency";
import { clearRecentSearches } from "@/lib/search-history";
import { FULL_CONFIDENCE_EVIDENCE, PERSONALIZED_WEIGHTS, recommendationService } from "@/services/recommendations";
import { useViewedStore } from "@/store/viewed-store";
import { titleCase } from "@/utils/text";
import { useRawSignals } from "../hooks/use-raw-signals";

const WEIGHT_LABELS: Record<keyof typeof PERSONALIZED_WEIGHTS, string> = {
  categoryMatch: "Category you browse",
  priceSimilarity: "Price close to your range",
  tagOverlap: "Shared tags with what you like",
  normalizedRating: "Product rating",
  recentlyViewedRelation: "Similar to what you viewed",
  wishlistRelation: "Similar to your wishlist",
  cartRelation: "Goes with your cart",
  brandAffinity: "Brands you favour",
  popularity: "General popularity (simulated)",
};

function level(value: number): string {
  return value >= 0.75 ? "strong" : value >= 0.4 ? "moderate" : "light";
}

function top(affinity: Record<string, number>, count: number): Array<[string, number]> {
  return Object.entries(affinity).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, count);
}

/**
 * The Recommendation Preferences panel (PRD 5.7, 6.1): shows which signals shape the shopper's recommendations, how the
 * scores are made, and lets them reset the browsing signals. Wishlist, cart and orders are account data, so they are
 * listed here but managed on their own pages.
 */
export function RecommendationPreferences() {
  const catalog = useCatalog();
  const raw = useRawSignals();
  const clearViewed = useViewedStore((state) => state.clear);
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const signals = useMemo(() => (catalog.data ? recommendationService.signals({ raw, catalog: catalog.data }) : null), [catalog.data, raw]);
  const titles = useMemo(() => new Map((catalog.data ?? []).map((product) => [product.id, product.title])), [catalog.data]);

  const hasBrowsing = raw.viewed.length > 0 || raw.searches.length > 0;
  const hasAnything = hasBrowsing || raw.wishlist.length > 0 || raw.cart.length > 0 || raw.orders.length > 0;
  const confidence = signals?.confidence ?? 0;
  const confidenceLabel = confidence >= 0.67 ? "High" : confidence >= 0.34 ? "Medium" : "Low";

  function resetViewing() {
    clearViewed();
    setMessage("Your viewing history was cleared.");
  }
  function resetSearches() {
    clearRecentSearches();
    setMessage("Your search history was cleared.");
  }
  function resetAll() {
    clearViewed();
    clearRecentSearches();
    setConfirming(false);
    setMessage("Your viewing and search history were cleared. Recommendations will now rely on your wishlist, cart and orders, and popular products.");
  }

  return (
    <section aria-labelledby="preferences-heading" className="mt-10">
      <h2 id="preferences-heading" className="text-2xl font-semibold tracking-tight">
        Recommendation preferences
      </h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        These are the signals behind the recommendations you see. They are worked out from your activity on this device and never leave your browser.
      </p>

      <p role="status" className="mt-4 text-sm font-medium text-primary">
        {message}
      </p>

      {!hasAnything ? (
        <p className="mt-4 rounded-xl border bg-card shadow-surface p-4 text-sm">
          We have not seen any activity on this device yet, so you are shown popular products. Browse some products, search, or save a few items and this page will show what influences your recommendations.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="pref-confidence" className="rounded-xl border bg-card shadow-surface p-4">
          <h3 id="pref-confidence" className="font-semibold">
            How much we know about your interests
          </h3>
          <div className="mt-3 flex items-center gap-3">
            <meter min={0} max={1} value={confidence} aria-label="How much we know about your interests" className="h-3 w-full max-w-xs" />
            <span className="text-sm font-medium">{`${confidenceLabel} (${Math.round(confidence * 100)}%)`}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {`With little activity, recommendations lean on popular products. Full personalization needs about ${FULL_CONFIDENCE_EVIDENCE} activity points (a viewed product is 1, a wishlist item 1.5, a cart item 2, an order item 1.5).`}
          </p>
        </section>

        <section aria-labelledby="pref-viewed" className="rounded-xl border bg-card shadow-surface p-4">
          <h3 id="pref-viewed" className="font-semibold">
            Because you viewed
          </h3>
          {signals && signals.viewedIds.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {signals.viewedIds.slice(0, 5).map((id) => {
                const title = titles.get(id);
                return (
                  <li key={id}>
                    {title ? (
                      <Link href={`/products/${id}`} className="underline-offset-4 hover:underline">
                        {title}
                      </Link>
                    ) : (
                      "A product that is no longer available"
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No products viewed yet.</p>
          )}
        </section>

        <section aria-labelledby="pref-price" className="rounded-xl border bg-card shadow-surface p-4">
          <h3 id="pref-price" className="font-semibold">
            Your typical price range
          </h3>
          <p className="mt-2 text-sm">
            {signals?.priceBand ? `${formatInr(signals.priceBand.min)} to ${formatInr(signals.priceBand.max)}` : "Not enough activity yet."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Based on the prices of products you viewed, saved, put in your cart or bought.</p>
        </section>

        <section aria-labelledby="pref-categories" className="rounded-xl border bg-card shadow-surface p-4">
          <h3 id="pref-categories" className="font-semibold">
            Categories and brands you seem to like
          </h3>
          {signals && top(signals.categoryAffinity, 3).length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {top(signals.categoryAffinity, 3).map(([slug, value]) => (
                <li key={slug}>{`${titleCase(slug)}: ${level(value)} interest`}</li>
              ))}
              {top(signals.brandAffinity, 3).map(([brand, value]) => (
                <li key={brand}>{`Brand ${brand}: ${level(value)} preference`}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not enough activity yet.</p>
          )}
        </section>

        <section aria-labelledby="pref-searches" className="rounded-xl border bg-card shadow-surface p-4">
          <h3 id="pref-searches" className="font-semibold">
            From your searches
          </h3>
          {raw.searches.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {raw.searches.slice(0, 3).map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No searches yet.</p>
          )}
        </section>

        <section aria-labelledby="pref-account" className="rounded-xl border bg-card shadow-surface p-4">
          <h3 id="pref-account" className="font-semibold">
            Your account activity
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link href="/wishlist" className="underline-offset-4 hover:underline">{`${raw.wishlist.length} on your wishlist`}</Link>
            </li>
            <li>
              <Link href="/cart" className="underline-offset-4 hover:underline">{`${raw.cart.length} in your cart`}</Link>
            </li>
            <li>
              <Link href="/orders" className="underline-offset-4 hover:underline">{`${raw.orders.length} past ${raw.orders.length === 1 ? "order" : "orders"}`}</Link>
            </li>
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">These also shape your recommendations. Change them on their own pages.</p>
        </section>
      </div>

      <details className="mt-6 rounded-xl border bg-card shadow-surface p-4">
        <summary className="cursor-pointer font-semibold">How recommendations are scored</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          Each product gets a score from 0 to 1: a weighted sum of the parts below. With little activity the score is blended with simulated popularity.
        </p>
        <table className="mt-3 w-full max-w-xl text-sm">
          <caption className="sr-only">Score components and weights</caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                Component
              </th>
              <th scope="col" className="py-1 font-medium">
                Weight
              </th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(PERSONALIZED_WEIGHTS) as Array<keyof typeof PERSONALIZED_WEIGHTS>).map((key) => (
              <tr key={key} className="border-b last:border-0">
                <td className="py-1 pr-4">{WEIGHT_LABELS[key]}</td>
                <td className="py-1">{`${Math.round(PERSONALIZED_WEIGHTS[key] * 100)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="mt-6 space-y-3">
        <h3 className="font-semibold">Reset your signals</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetViewing} disabled={raw.viewed.length === 0}>
            Clear viewing history
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetSearches} disabled={raw.searches.length === 0}>
            Clear search history
          </Button>
          {confirming ? (
            <span role="group" aria-label="Confirm reset" className="flex flex-wrap items-center gap-2">
              <span className="text-sm">Clear both your viewing and search history on this device?</span>
              <Button type="button" size="sm" onClick={resetAll}>
                Yes, reset
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)} disabled={!hasBrowsing}>
              Reset all browsing signals
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Your wishlist, cart and orders are not affected.</p>
      </div>
    </section>
  );
}
