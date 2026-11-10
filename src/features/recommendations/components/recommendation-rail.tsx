"use client";

import { useEffect, useId, useRef } from "react";

import { ProductCard, useCatalog } from "@/features/products";
import { cn } from "@/lib/utils";
import type { StrategyId } from "@/services/recommendations";
import { useAnalyticsStore } from "@/store/analytics-store";
import { useRecommendations } from "../hooks/use-recommendations";

interface RecommendationRailProps {
  strategy: StrategyId;
  /** The product a product-page rail is anchored to. */
  productId?: number;
  /** A category the rail is anchored to, as on a category page. */
  categorySlug?: string;
  excludeIds?: number[];
  limit?: number;
  /**
   * What to do when there was not enough signal and popular products were substituted: "show" them under their own
   * honest heading ("Popular Right Now"), or "hide" the rail when the page already shows popular products.
   */
  fallback?: "show" | "hide";
  /**
   * "scroll" (default) is one row that scrolls sideways. "grid" wraps into a responsive grid from the large breakpoint
   * up and stays a sideways scroller on smaller screens.
   */
  layout?: "scroll" | "grid";
}

/** Strategies that always have something to show, so a loading skeleton will not turn into a vanishing rail. */
const ALWAYS_AVAILABLE: ReadonlySet<StrategyId> = new Set<StrategyId>(["featured", "trending", "similar", "frequently-bought-together"]);

function RailSkeleton() {
  return (
    <section aria-hidden="true" aria-busy="true" className="mt-10">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <ul className="mt-5 flex gap-3 overflow-hidden sm:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="w-48 shrink-0 space-y-2 rounded-2xl border bg-card p-3 sm:w-56">
            <div className="aspect-square animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A recommendation rail (PRD 6.3). Its heading says what it is based on, and every card says why it is there.
 * A rail with no candidates renders nothing: never an empty box (PRD edge case 16). Out-of-stock products are
 * excluded by the engine, except in Recently Viewed where the card marks them as out of stock (edge case 23).
 */
export function RecommendationRail({ strategy, productId, categorySlug, excludeIds, limit, fallback = "show", layout = "scroll" }: RecommendationRailProps) {
  const headingId = useId();
  const state = useRecommendations({
    strategy,
    ...(productId !== undefined ? { productId } : {}),
    ...(categorySlug !== undefined ? { categorySlug } : {}),
    ...(excludeIds ? { excludeIds } : {}),
    ...(limit !== undefined ? { limit } : {}),
  });

  const shownIds = state.status === "ready" && state.result.items.length > 0 && !(state.result.fallback && fallback === "hide") ? state.result.items.map((item) => item.product.id).join(",") : "";
  const countedRef = useRef("");

  // Local analytics (PRD 8.4): each set of cards the shopper is shown counts once per mount (a ref also survives React strict mode's repeat effect).
  useEffect(() => {
    const key = `${strategy}:${shownIds}`;
    if (shownIds === "" || countedRef.current === key) return;
    countedRef.current = key;
    useAnalyticsStore.getState().impressions(strategy, shownIds.split(",").length);
  }, [strategy, shownIds]);

  if (state.status === "unavailable") return null;
  if (state.status === "loading") return ALWAYS_AVAILABLE.has(strategy) || categorySlug !== undefined ? <RailSkeleton /> : null;

  const { result } = state;
  if (result.items.length === 0) return null;
  if (result.fallback && fallback === "hide") return null;

  return (
    <section aria-labelledby={headingId} data-strategy={strategy} data-fallback={result.fallback ? "true" : "false"} className="mt-10">
      <h2 id={headingId} className="font-display text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] font-semibold leading-tight tracking-tight">
        {result.heading}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{`Based on ${result.basedOn}`}</p>
      {/* Extra bottom padding (cancelled by the negative margin) leaves room for the cards' lift and shadow, which the scroller would clip. */}
      <ul
        data-layout={layout}
        className={cn(
          "scroll-fade -mb-4 mt-4 flex snap-x gap-3 overflow-x-auto scroll-smooth pb-8 pt-2 sm:gap-4",
          layout === "grid" && "lg:grid lg:grid-cols-4 lg:overflow-visible",
        )}
      >
        {result.items.map((item) => (
          <li
            key={item.product.id}
            className={cn("w-48 shrink-0 snap-start sm:w-56", layout === "grid" && "lg:w-auto")}
            onClick={(event) => {
              // Only a click on the card's link is a click-through; the wishlist heart is not.
              if ((event.target as Element).closest("a")) useAnalyticsStore.getState().click(strategy, item.product.id);
            }}
          >
            <ProductCard product={item.product} {...(item.reasons[0] ? { reason: item.reasons[0] } : {})} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The rails of a product page (PRD 5.4): similar, bought together, more in the category, and personalized. */
export function ProductPageRecommendations({ productId }: { productId: string }) {
  const catalog = useCatalog();
  if (!/^[1-9][0-9]{0,8}$/.test(productId)) return null;
  const id = Number(productId);
  const category = catalog.data?.find((product) => product.id === id)?.category;

  return (
    <div>
      <RecommendationRail strategy="similar" productId={id} />
      <RecommendationRail strategy="frequently-bought-together" productId={id} />
      {category ? <RecommendationRail strategy="category-based" categorySlug={category} excludeIds={[id]} /> : null}
      <RecommendationRail strategy="personalized" excludeIds={[id]} />
    </div>
  );
}
