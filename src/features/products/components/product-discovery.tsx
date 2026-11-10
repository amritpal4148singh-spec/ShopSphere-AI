"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { POPULAR_SEARCHES } from "@/lib/popular-searches";
import {
  PAGE_SIZE,
  applyFilters,
  clearAllFilters,
  getActiveFilters,
  getBrandOptions,
  getPriceBounds,
  paginate,
  removeFilter,
  sortProducts,
  type FilterKey,
} from "@/utils/discovery";
import { parseDiscoveryParams, serializeDiscoveryParams } from "@/utils/discovery-params";
import { findSimilarTerms, titleCase } from "@/utils/text";
import type { DiscoveryState, Product } from "@/types/product";
import { useCategories } from "../hooks/use-categories";
import { useProductSource } from "../hooks/use-product-source";
import { Dialog } from "@/components/ui/dialog";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ActiveFilters } from "./active-filters";
import { CategoryLinks } from "./category-links";
import { CategoryNotFound, ErrorState, NoMatches, NoSearchResults, RetryBanner } from "./discovery-states";
import { DiscoverySkeleton } from "./discovery-skeleton";
import { FilterPanel } from "./filter-panel";
import { ProductGrid } from "./product-grid";
import { SortSelect } from "./sort-select";

interface ProductDiscoveryProps {
  /** Route the view lives on; filter state is written to its query string. */
  basePath: string;
  /** Set on category pages: products are limited to this category slug. */
  fixedCategory?: string;
}

const NO_PRODUCTS: Product[] = [];

export function ProductDiscovery({ basePath, fixedCategory }: ProductDiscoveryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();

  const state = useMemo(
    () => parseDiscoveryParams(new URLSearchParams(paramsKey), fixedCategory ? { fixedCategory } : {}),
    [paramsKey, fixedCategory],
  );

  const source = useProductSource(state.query);
  const categoriesQuery = useCategories();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // From 1024px the filters are a sidebar; below that they open as a bottom sheet (PRD 15).
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const categoryNames = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((category) => [category.slug, category.name])),
    [categoriesQuery.data],
  );
  const categoryName = useCallback((slug: string) => categoryNames.get(slug) ?? titleCase(slug), [categoryNames]);

  const allProducts = source.data ?? NO_PRODUCTS;
  const scope = useMemo(
    () => (fixedCategory ? allProducts.filter((product) => product.category === fixedCategory) : allProducts),
    [allProducts, fixedCategory],
  );
  const bounds = useMemo(() => getPriceBounds(scope), [scope]);
  const brands = useMemo(() => getBrandOptions(scope), [scope]);
  const categoryOptions = useMemo(
    () =>
      [...new Set(scope.map((product) => product.category))]
        .map((slug) => ({ slug, name: categoryName(slug) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scope, categoryName],
  );

  const sorted = useMemo(() => sortProducts(applyFilters(scope, state), state.sort), [scope, state]);
  const pageData = useMemo(() => paginate(sorted, state.page, PAGE_SIZE), [sorted, state.page]);
  const activeFilters = useMemo(
    () => getActiveFilters(state, categoryName, fixedCategory),
    [state, categoryName, fixedCategory],
  );

  const navigate = useCallback(
    (next: DiscoveryState, mode: "push" | "replace") => {
      const query = serializeDiscoveryParams(next, fixedCategory ? { fixedCategory } : {}).toString();
      router[mode](query ? `${basePath}?${query}` : basePath, { scroll: false });
    },
    [basePath, fixedCategory, router],
  );

  const update = useCallback(
    (patch: Partial<DiscoveryState>) => navigate({ ...state, page: 1, ...patch }, "replace"),
    [navigate, state],
  );

  const changePage = (page: number) => {
    navigate({ ...state, page }, "push");
    document.getElementById("discovery-top")?.scrollIntoView?.({ block: "start" });
  };

  const clearFilters = () => navigate(clearAllFilters(state, fixedCategory), "replace");

  const heading = state.query
    ? `Results for “${state.query}”`
    : fixedCategory
      ? categoryName(fixedCategory)
      : "All products";

  const searchSuggestions = useMemo(
    () =>
      state.query
        ? findSimilarTerms(state.query, [...(categoriesQuery.data ?? []).map((category) => category.name), ...POPULAR_SEARCHES])
        : [],
    [state.query, categoriesQuery.data],
  );

  function renderContent() {
    if (source.isPending) return <DiscoverySkeleton />;
    if (source.isError && !source.data) return <ErrorState error={source.error} onRetry={() => void source.refetch()} />;

    const retryBanner = source.isError ? <RetryBanner error={source.error} onRetry={() => void source.refetch()} /> : null;

    if (scope.length === 0) {
      return (
        <>
          {retryBanner}
          {fixedCategory ? (
            <CategoryNotFound />
          ) : state.query ? (
            <NoSearchResults query={state.query} suggestions={searchSuggestions} />
          ) : (
            <ErrorState error={null} onRetry={() => void source.refetch()} />
          )}
        </>
      );
    }

    return (
      <>
        {retryBanner}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {`${pageData.total} ${pageData.total === 1 ? "product" : "products"}`}
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="lg:hidden"
              aria-haspopup="dialog"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Filters
            </Button>
            <SortSelect value={state.sort} onChange={(sort) => update({ sort })} />
          </div>
        </div>

        <ActiveFilters
          filters={activeFilters}
          onRemove={(key: FilterKey) => navigate(removeFilter(state, key), "replace")}
          onClearAll={clearFilters}
        />

        <div className="mt-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
          {isDesktop ? (
            <div id="filter-panel">
              <FilterPanel
                state={state}
                bounds={bounds}
                brands={brands}
                categories={categoryOptions}
                showCategories={!fixedCategory}
                hasActiveFilters={activeFilters.length > 0}
                onChange={update}
                onClear={clearFilters}
              />
            </div>
          ) : null}

          <div>
            {sorted.length === 0 ? (
              <NoMatches filters={activeFilters} onClear={clearFilters} />
            ) : (
              <>
                <ProductGrid products={pageData.items} />
                <Pagination page={pageData.page} totalPages={pageData.totalPages} onPageChange={changePage} />
              </>
            )}
          </div>
        </div>

        <Dialog open={filtersOpen && !isDesktop} onClose={() => setFiltersOpen(false)} title="Filters">
          <FilterPanel
            state={state}
            bounds={bounds}
            brands={brands}
            categories={categoryOptions}
            showCategories={!fixedCategory}
            hasActiveFilters={activeFilters.length > 0}
            onChange={update}
            onClear={clearFilters}
          />
          <Button type="button" variant="cta" className="mt-5 w-full" onClick={() => setFiltersOpen(false)}>
            {`Show ${pageData.total} ${pageData.total === 1 ? "product" : "products"}`}
          </Button>
        </Dialog>
      </>
    );
  }

  return (
    <section id="discovery-top" className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="page-title">{heading}</h1>
      {fixedCategory ? (
        <p className="mt-2 text-sm">
          <Link href="/products" className="text-primary underline-offset-4 hover:underline">
            All products
          </Link>
        </p>
      ) : null}
      {!fixedCategory && !state.query && categoriesQuery.data ? <CategoryLinks categories={categoriesQuery.data} /> : null}
      {renderContent()}
    </section>
  );
}
