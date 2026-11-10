"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { FavoriteButton } from "@/components/ui/favorite-button";
import { Tabs } from "@/components/ui/tabs";
import { useWishlistToggle } from "@/hooks/use-wishlist-toggle";
import { formatInr } from "@/lib/currency";
import { ProductReviews, useReviewSummary } from "@/features/reviews";
import { ApiError } from "@/services/products";
import { titleCase } from "@/utils/text";
import type { ProductDetail } from "@/types/product";
import { useCategories } from "../hooks/use-categories";
import { useRecordView } from "../hooks/use-record-view";
import { useProduct } from "../hooks/use-product";
import { DeliveryEstimator } from "./delivery-estimator";
import { ErrorState, RetryBanner } from "./discovery-states";
import { ProductDetailSkeleton, ProductUnavailable } from "./product-detail-states";
import { ProductGallery } from "./product-gallery";
import { ProductSpecs } from "./product-specs";
import { PurchasePanel } from "./purchase-panel";

/** "42" -> 42. Anything else (letters, zero, negatives, decimals) is not a product id. */
function parseProductId(value: string): number | null {
  return /^[1-9][0-9]{0,8}$/.test(value) ? Number(value) : null;
}

function Breadcrumb({ product, categoryName }: { product: ProductDetail; categoryName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <li>
          <Link href="/" className="rounded-sm hover:text-foreground">
            Home
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href="/products" className="rounded-sm hover:text-foreground">
            Shop
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link href={`/category/${product.category}`} className="rounded-sm hover:text-foreground">
            {categoryName}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="min-w-0 truncate text-foreground">
          {product.title}
        </li>
      </ol>
    </nav>
  );
}

function ProductHeader({ product, categoryName }: { product: ProductDetail; categoryName: string }) {
  const { pressed, toggle } = useWishlistToggle(product);
  // The rating line is the average of the reviews listed below (PRD 5.4, 5.10), so a new review changes it.
  const summary = useReviewSummary(product.id, product.reviews);
  const discounted = product.finalPrice < product.price;

  return (
    <header className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {product.brand ? `${product.brand} · ` : ""}
        <Link href={`/category/${product.category}`} className="rounded-sm underline-offset-4 hover:underline">
          {categoryName}
        </Link>
      </p>
      <div className="flex items-start justify-between gap-3">
        <h1 className="page-title">{product.title}</h1>
        <FavoriteButton name={product.title} pressed={pressed} onToggle={toggle} className="mt-1 shrink-0" />
      </div>

      {summary.count > 0 ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1" role="img" aria-label={`Rated ${summary.average.toFixed(1)} out of 5`}>
            <Star aria-hidden="true" className="size-4 fill-current text-star" />
            <span aria-hidden="true">{summary.average.toFixed(1)}</span>
          </span>
          <a href="#reviews" className="rounded-sm text-muted-foreground underline-offset-4 hover:underline">
            {`(${summary.count} ${summary.count === 1 ? "review" : "reviews"})`}
          </a>
        </p>
      ) : product.rating > 0 ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1" role="img" aria-label={`Rated ${product.rating.toFixed(1)} out of 5`}>
            <Star aria-hidden="true" className="size-4 fill-current text-star" />
            <span aria-hidden="true">{product.rating.toFixed(1)}</span>
          </span>
          <span className="text-muted-foreground">(no reviews yet)</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No ratings yet</p>
      )}

      <p className="flex flex-wrap items-baseline gap-x-3 pt-1">
        <span className="font-display text-4xl font-semibold tracking-tight">{formatInr(product.finalPrice)}</span>
        {discounted ? (
          <>
            <span className="text-lg text-muted-foreground line-through">
              <span className="sr-only">Original price </span>
              {formatInr(product.price)}
            </span>
            <span className="rounded-full bg-sale px-2.5 py-1 text-sm font-bold leading-none text-sale-foreground">
              {`${Math.round(product.discountPercentage)}% off`}
            </span>
          </>
        ) : null}
      </p>
    </header>
  );
}

interface ProductDetailViewProps {
  productId: string;
  /** Recommendation rails, supplied by the route so this feature does not depend on the recommendations feature. */
  recommendations?: ReactNode;
}

/** Renders nothing; records the view once the product has loaded. */
function ViewRecorder({ product }: { product: ProductDetail }) {
  useRecordView(product);
  return null;
}

export function ProductDetailView({ productId, recommendations }: ProductDetailViewProps) {
  const id = parseProductId(productId);
  const query = useProduct(id);
  const categories = useCategories();
  const product = query.data;

  useEffect(() => {
    if (product) document.title = `${product.title} | ShopSphere AI`;
  }, [product]);

  if (id === null) return <ProductUnavailable />;
  if (query.isPending) return <ProductDetailSkeleton />;

  if (!product) {
    if (query.error instanceof ApiError && query.error.status === 404) return <ProductUnavailable />;
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const categoryName = categories.data?.find((category) => category.slug === product.category)?.name ?? titleCase(product.category);

  return (
    <article className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
      <ViewRecorder product={product} />
      <Breadcrumb product={product} categoryName={categoryName} />
      {query.isError ? <RetryBanner error={query.error} onRetry={() => void query.refetch()} /> : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <ProductGallery images={product.images} title={product.title} />
        </div>
        <div className="min-w-0 space-y-6">
          <ProductHeader product={product} categoryName={categoryName} />
          <PurchasePanel key={product.id} product={product} />
          <DeliveryEstimator product={product} available={product.availability !== "out-of-stock"} />
        </div>
      </div>

      <div className="mt-10">
        <Tabs
          label="Product information"
          tabs={[
            {
              id: "description",
              label: "Description",
              content: <p className="max-w-3xl whitespace-pre-line leading-relaxed">{product.description || "No description available."}</p>,
            },
            { id: "specifications", label: "Specifications", content: <ProductSpecs product={product} /> },
          ]}
        />
      </div>

      <ProductReviews productId={product.id} catalogueReviews={product.reviews} />

      {recommendations}
    </article>
  );
}
