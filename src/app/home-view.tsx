"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CategoryStrip, useCatalog, useCategories } from "@/features/products";
import { HeroShowcase, RecommendationRail } from "@/features/recommendations";
import { cn } from "@/lib/utils";

/** What the catalogue holds, from the loaded data. Reserves its line so nothing moves when the numbers arrive. */
function CatalogueFacts() {
  const productCount = useCatalog().data?.length ?? 0;
  const categoryCount = useCategories().data?.length ?? 0;
  const text = productCount > 0 ? `Browse ${productCount} products${categoryCount > 0 ? ` across ${categoryCount} categories` : ""}.` : "";

  return (
    <p className={cn("mt-7 flex min-h-6 items-center gap-3 text-sm font-medium text-muted-foreground transition-opacity duration-700", text ? "opacity-100" : "opacity-0")}>
      <span aria-hidden="true" className="h-px w-10 bg-gold-edge" />
      <span>{text}</span>
    </p>
  );
}

/**
 * The landing page (PRD 5.1). A first-time visitor sees Featured and Trending products; once there is activity,
 * Recently Viewed and personalized rails appear, each saying what it is based on. Rails with nothing to show hide.
 */
export function HomeView() {
  return (
    <div className="home-page">
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(58%_80%_at_82%_45%,var(--sand),transparent_72%),repeating-radial-gradient(circle_at_80%_48%,transparent_0_5.5rem,color-mix(in_srgb,var(--gold)_26%,transparent)_5.5rem_calc(5.5rem+1px))]"
        />
        <div className="home-band grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-16 xl:py-20">
          <div>
            <h1 className="animate-rise font-display text-[clamp(3.1rem,1.2rem+7.6vw,7.25rem)] font-normal leading-[0.94] tracking-[-0.035em] text-primary text-balance">ShopSphere AI</h1>
            <p className="mt-6 max-w-xl animate-rise font-display text-[clamp(1.4rem,1.1rem+1.1vw,2.1rem)] font-normal leading-[1.15] tracking-tight [animation-delay:90ms]">
              Personalized shopping that shows its reasoning.
            </p>
            <p className="mt-4 max-w-xl animate-rise text-base leading-relaxed text-muted-foreground sm:text-lg [animation-delay:180ms]">
              A storefront that shows you why it recommends what it does. Browse the catalogue, search for something specific, or start with the picks below.
            </p>
            <div className="mt-8 flex animate-rise flex-wrap gap-3 [animation-delay:270ms]">
              <Button asChild size="lg" variant="cta" className="min-w-40 flex-1 rounded-full px-8 sm:flex-none">
                <Link href="/products">Browse products</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-w-40 flex-1 rounded-full border-primary px-8 font-bold text-primary hover:bg-primary hover:text-primary-foreground sm:flex-none">
                <Link href="/products?onSale=1&sort=rating">Shop deals</Link>
              </Button>
            </div>
            <div className="animate-rise [animation-delay:360ms]">
              <CatalogueFacts />
            </div>
          </div>

          <HeroShowcase />
        </div>
      </section>

      <div className="home-band border-y border-border bg-card/70 py-2 empty:hidden [&>*]:mt-0">
        <CategoryStrip />
      </div>

      <div className="home-rails">
        <RecommendationRail strategy="featured" layout="grid" />
        <RecommendationRail strategy="trending" />
        <RecommendationRail strategy="recently-viewed" />
        <RecommendationRail strategy="personalized" fallback="hide" />
        <RecommendationRail strategy="category-based" />
        <RecommendationRail strategy="price-based" />
        <RecommendationRail strategy="wishlist-based" />
      </div>
    </div>
  );
}
