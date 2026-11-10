"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { useOrdersStore } from "@/store/orders-store";
import { useReviewsStore } from "@/store/reviews-store";
import { GUEST_VOTER, SORT_LABELS, hasPurchased, sortReviews } from "@/utils/reviews";
import type { CatalogueReview, ReviewSort } from "@/types/review";
import { useProductReviews } from "../hooks/use-product-reviews";
import { RatingDistribution } from "./rating-distribution";
import { ReviewForm } from "./review-form";
import { ReviewItem } from "./review-item";
import { StarDisplay } from "./star-rating";

const PAGE_SIZE = 5;
const SORTS = Object.keys(SORT_LABELS) as ReviewSort[];

interface ProductReviewsProps {
  productId: number;
  catalogueReviews: readonly CatalogueReview[];
}

function ReviewsSkeleton() {
  return (
    <section id="reviews" aria-label="Customer reviews" className="mt-12">
      <p role="status" className="sr-only">
        Loading reviews
      </p>
      <div aria-hidden="true" className="space-y-3">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    </section>
  );
}

/**
 * The review module on a product page (PRD 5.10): summary with a rating distribution, sortable list with
 * helpful voting, a verified-purchase marker derived from the customer's local order history, and a form for
 * signed-in customers. Administrators see moderation controls instead (PRD 4.3). Everything is stored locally (PRD 10.1).
 */
export function ProductReviews({ productId, catalogueReviews }: ProductReviewsProps) {
  const { ready, all, visible, summary } = useProductReviews(productId, catalogueReviews);
  const { user } = useAuth();
  const orders = useOrdersStore((state) => state.orders);
  const votes = useReviewsStore((state) => state.votes);
  const saveFailed = useReviewsStore((state) => state.saveFailed);
  const sortId = useId();

  const [sort, setSort] = useState<ReviewSort>("recent");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");

  const moderator = user?.role === "admin";
  const customerId = user?.role === "customer" ? user.id : null;
  const voterKey = user?.id ?? GUEST_VOTER;
  const verified = useMemo(() => hasPurchased(orders, productId), [orders, productId]);
  const myReview = customerId ? all.find((review) => review.source === "shopper" && review.authorId === customerId) : undefined;

  const list = useMemo(() => sortReviews(moderator ? all : visible, sort), [moderator, all, visible, sort]);

  if (!ready) return <ReviewsSkeleton />;

  const store = useReviewsStore.getState;

  function submit(values: { rating: number; body: string }) {
    if (!user || !customerId) return;
    const outcome = store().submit({ productId, authorId: user.id, authorName: user.name, ...values, verifiedPurchase: verified });
    setNotice(outcome === "added" ? "Thank you. Your review was saved on this device." : "You have already reviewed this product. You can edit your review instead.");
  }

  function saveEdit(values: { rating: number; body: string }) {
    if (!customerId) return;
    const outcome = store().edit(myReview?.id ?? "", customerId, { ...values, verifiedPurchase: verified });
    setEditing(false);
    setNotice(outcome === "edited" ? "Your review was updated." : "That review no longer exists.");
  }

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="mt-12 scroll-mt-24">
      <h2 id="reviews-heading" className="text-2xl font-semibold tracking-tight">
        Customer reviews
      </h2>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="space-y-6">
          {summary.count > 0 ? (
            <div className="space-y-4 rounded-xl border bg-card shadow-surface p-4">
              <div>
                <p className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold" data-testid="review-average">
                    {summary.average.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">out of 5</span>
                </p>
                <StarDisplay rating={summary.average} decorative />
                <p className="mt-1 text-sm text-muted-foreground">{`Based on ${summary.count} ${summary.count === 1 ? "review" : "reviews"}`}</p>
              </div>
              <RatingDistribution summary={summary} />
            </div>
          ) : null}

          {moderator ? (
            <p className="rounded-xl border bg-card shadow-surface p-4 text-sm text-muted-foreground">
              Administrators moderate reviews instead of writing them. Hide or restore a review below, or{" "}
              <Link href="/admin/reviews" className="text-primary underline-offset-4 hover:underline">
                open the moderation list
              </Link>
              .
            </p>
          ) : customerId && editing && myReview ? (
            <ReviewForm mode="edit" initial={{ rating: myReview.rating, body: myReview.body }} verified={verified} onSubmit={saveEdit} onCancel={() => setEditing(false)} />
          ) : customerId && !myReview ? (
            <ReviewForm mode="new" verified={verified} onSubmit={submit} />
          ) : customerId ? (
            <p className="rounded-xl border bg-card shadow-surface p-4 text-sm text-muted-foreground">You have reviewed this product. You can edit or delete your review in the list.</p>
          ) : (
            <p className="rounded-xl border bg-card shadow-surface p-4 text-sm">
              <Link href={`/login?next=${encodeURIComponent(`/products/${productId}`)}`} className="font-medium text-primary underline-offset-4 hover:underline">
                Sign in to write a review
              </Link>
              <span className="mt-1 block text-muted-foreground">Only signed-in customers can submit reviews.</span>
            </p>
          )}
        </div>

        <div className="min-w-0">
          <p role="status" className="min-h-5 text-sm font-medium text-primary">
            {notice}
          </p>
          {saveFailed ? (
            <p role="alert" className="mb-3 rounded-md border border-destructive p-3 text-sm text-destructive">
              Your browser would not save this change, so it will be lost when you leave this page. Check that storage is not blocked or full.
            </p>
          ) : null}

          {list.length === 0 ? (
            <div className="rounded-xl border bg-card shadow-surface p-6">
              <h3 className="section-title">No reviews yet</h3>
              <p className="mt-1 text-muted-foreground">{customerId ? "Be the first to review this product using the form." : "Sign in to be the first to review this product."}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-sm text-muted-foreground">{`Showing ${Math.min(shown, list.length)} of ${list.length} ${list.length === 1 ? "review" : "reviews"}`}</p>
                <div className="flex items-center gap-2">
                  <label htmlFor={sortId} className="text-sm font-medium">
                    Sort reviews
                  </label>
                  <select
                    id={sortId}
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value as ReviewSort);
                      setShown(PAGE_SIZE);
                    }}
                    className="h-9 rounded-lg border border-input bg-card px-2 text-sm"
                  >
                    {SORTS.map((key) => (
                      <option key={key} value={key}>
                        {SORT_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <ul aria-label="Reviews" className="mt-4 space-y-3">
                {list.slice(0, shown).map((review) =>
                  editing && myReview?.id === review.id ? null : (
                    <li key={review.id}>
                      <ReviewItem
                        review={review}
                        own={customerId !== null && review.authorId === customerId}
                        moderator={moderator}
                        myVote={votes[voterKey]?.[review.id]}
                        onVote={(choice) => store().vote(voterKey, review.id, choice)}
                        onEdit={() => {
                          setNotice("");
                          setEditing(true);
                        }}
                        onDelete={() => {
                          if (customerId) store().remove(review.id, customerId);
                          setEditing(false);
                          setNotice("Your review was deleted.");
                        }}
                        onToggleHidden={() => {
                          if (review.hidden) {
                            store().restore(review.id);
                            setNotice("Review restored (local simulation).");
                          } else {
                            store().hide({ reviewId: review.id, productId, source: review.source, authorName: review.authorName, rating: review.rating, body: review.body });
                            setNotice("Review hidden from shoppers (local simulation).");
                          }
                        }}
                      />
                    </li>
                  ),
                )}
              </ul>

              {list.length > shown ? (
                <Button type="button" variant="outline" className="mt-4" onClick={() => setShown((count) => count + PAGE_SIZE)}>
                  {`Show more reviews (${list.length - shown} remaining)`}
                </Button>
              ) : null}
              <p className="mt-4 text-xs text-muted-foreground">
                Verified purchase means the reviewer&rsquo;s own order history on this device includes the product. Reviews, votes and moderation are stored in this browser only.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
