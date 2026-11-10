"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalBadge } from "@/components/ui/local-badge";
import { Pagination } from "@/components/ui/pagination";
import { SAMPLE_REVIEWS } from "@/data/review-data";
import { StarDisplay } from "@/features/reviews";
import { useCatalog } from "@/features/products";
import { formatDate } from "@/lib/format";
import { useReviewsStore } from "@/store/reviews-store";
import { collectModerationReviews } from "@/utils/reviews";
import { paginate } from "@/utils/discovery";
import type { ReviewSource } from "@/types/review";
import { AdminPage } from "./admin-page";
import { AdminSkeleton, EmptyState } from "./admin-states";

const PAGE_SIZE = 10;
const SOURCE_LABEL: Record<ReviewSource, string> = { shopper: "Written on this device", sample: "Sample data", catalogue: "Product API" };
type StateFilter = "all" | "visible" | "hidden";

/**
 * Review moderation (PRD 4.3: administrators "Moderate"). Lists the reviews known without opening a product page: written on
 * this device, sample data, and anything hidden from the product API. Hiding is reversible and a local simulation.
 * To moderate other product API reviews, use the controls on that product's page.
 */
export function AdminReviewsView() {
  const status = useReviewsStore((state) => state.status);
  const reviews = useReviewsStore((state) => state.reviews);
  const votes = useReviewsStore((state) => state.votes);
  const hidden = useReviewsStore((state) => state.hidden);
  const catalog = useCatalog();
  const ids = useId();
  const [filter, setFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");

  const titles = useMemo(() => new Map((catalog.data ?? []).map((product) => [product.id, product.title])), [catalog.data]);
  const all = useMemo(() => collectModerationReviews(SAMPLE_REVIEWS, { reviews, votes, hidden }).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [reviews, votes, hidden]);
  const list = useMemo(() => {
    const text = query.trim().toLowerCase();
    return all
      .filter((review) => filter === "all" || (filter === "hidden") === review.hidden)
      .filter((review) => text === "" || `${review.authorName} ${review.body} ${titles.get(review.productId) ?? ""} ${review.productId}`.toLowerCase().includes(text));
  }, [all, filter, query, titles]);
  const current = paginate(list, page, PAGE_SIZE);

  return (
    <AdminPage
      title="Review moderation"
      description="Hide reviews that should not be shown to shoppers, and restore them later. Hidden reviews are left out of every product's rating and review count."
      actions={<LocalBadge />}
    >
      {status === "idle" ? (
        <AdminSkeleton label="Loading reviews" />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-f`} className="text-sm font-medium">Show</label>
              <select id={`${ids}-f`} value={filter} onChange={(event) => { setFilter(event.target.value as StateFilter); setPage(1); }} className="h-10 rounded-lg border border-input bg-card px-2 text-sm">
                <option value="all">All reviews</option>
                <option value="visible">Visible to shoppers</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-q`} className="text-sm font-medium">Search reviews</label>
              <Input id={`${ids}-q`} type="search" value={query} placeholder="Author, text or product" onChange={(event) => { setQuery(event.target.value.slice(0, 100)); setPage(1); }} />
            </div>
          </div>
          <p role="status" className="min-h-5 text-sm font-medium text-primary">{notice}</p>

          {list.length === 0 ? (
            <EmptyState title="No reviews to show">Try another filter.</EmptyState>
          ) : (
            <>
              <p aria-live="polite" className="text-sm text-muted-foreground">{`${list.length} ${list.length === 1 ? "review" : "reviews"}`}</p>
              <ul aria-label="Reviews to moderate" className="space-y-3">
                {current.items.map((review) => (
                  <li key={review.id} data-hidden={review.hidden ? "true" : "false"} className="space-y-2 rounded-xl border bg-card shadow-surface p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StarDisplay rating={review.rating} />
                      <p className="font-medium">{review.authorName}</p>
                      <span className="rounded-full border px-2 py-0.5 text-xs">{SOURCE_LABEL[review.source]}</span>
                      {review.hidden ? <span className="rounded-full border border-warning/40 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Hidden</span> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/products/${review.productId}#reviews`} className="underline-offset-4 hover:underline">{titles.get(review.productId) ?? `Product #${review.productId}`}</Link>
                      {review.createdAt !== null ? ` · ${formatDate(review.createdAt)}` : ""}
                    </p>
                    <p className="whitespace-pre-line break-words text-sm">{review.body || "Rating only, no written review."}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <LocalBadge />
                      {review.hidden ? (
                        <Button size="sm" variant="outline" onClick={() => { useReviewsStore.getState().restore(review.id); setNotice(`Review by ${review.authorName} restored (local simulation).`); }}>
                          Restore<span className="sr-only">{` review by ${review.authorName}`}</span>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { useReviewsStore.getState().hide({ reviewId: review.id, productId: review.productId, source: review.source, authorName: review.authorName, rating: review.rating, body: review.body }); setNotice(`Review by ${review.authorName} hidden (local simulation).`); }}>
                          Hide<span className="sr-only">{` review by ${review.authorName}`}</span>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={current.page} totalPages={current.totalPages} onPageChange={setPage} />
            </>
          )}
        </>
      )}
    </AdminPage>
  );
}
