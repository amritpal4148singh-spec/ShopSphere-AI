"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { ProductImage, useCatalog } from "@/features/products";
import { ReviewForm, StarDisplay } from "@/features/reviews";
import { formatDate } from "@/lib/format";
import { useOrdersStore } from "@/store/orders-store";
import { useReviewsStore } from "@/store/reviews-store";
import { hasPurchased } from "@/utils/reviews";

/**
 * My reviews (PRD 5.7): the reviews the customer wrote, each editable and removable. Rules come from the review store
 * (one review per product, verified purchase from local orders); this section only lists and edits them.
 */
export function MyReviewsSection() {
  const { user } = useAuth();
  const status = useReviewsStore((state) => state.status);
  const reviews = useReviewsStore((state) => state.reviews);
  const hidden = useReviewsStore((state) => state.hidden);
  const orders = useOrdersStore((state) => state.orders);
  const catalog = useCatalog();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const headingId = useId();

  const mine = useMemo(
    () => (user ? reviews.filter((review) => review.authorId === user.id).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)) : []),
    [reviews, user],
  );
  const products = useMemo(() => new Map((catalog.data ?? []).map((product) => [product.id, product])), [catalog.data]);

  if (!user) return null;
  const store = useReviewsStore.getState;

  function save(reviewId: string, productId: number, values: { rating: number; body: string }) {
    const outcome = store().edit(reviewId, user!.id, { ...values, verifiedPurchase: hasPurchased(orders, productId) });
    setEditingId(null);
    setNotice(outcome === "edited" ? "Review updated." : "That review no longer exists.");
  }

  function remove(reviewId: string) {
    store().remove(reviewId, user!.id);
    setConfirmId(null);
    setNotice("Review deleted.");
  }

  return (
    <section aria-labelledby={headingId} className="rounded-xl border bg-card p-4 shadow-surface sm:p-6">
      <h2 id={headingId} className="section-title">
        My reviews
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">Reviews you wrote on this device. You can edit or delete them at any time.</p>
      <p role="status" className={notice ? "mt-3 text-sm font-medium text-success" : "sr-only"}>
        {notice}
      </p>

      {status !== "ready" ? (
        <div aria-busy="true" className="mt-4 h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      ) : mine.length === 0 ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
          <p className="font-medium">You have not written any reviews yet</p>
          <p className="text-sm text-muted-foreground">Reviews you write on product pages will appear here.</p>
          <Button asChild>
            <Link href="/products">Browse products</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {mine.map((review) => {
            const product = products.get(review.productId);
            const isHidden = hidden[review.id] !== undefined;
            return (
              <li key={review.id} className="rounded-lg border bg-background p-4" data-testid="my-review">
                <div className="flex gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                    {product ? <ProductImage src={product.thumbnail} sizes="64px" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${review.productId}`} className="font-semibold underline-offset-4 hover:underline">
                      {product?.title ?? `Product ${review.productId}`}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <StarDisplay rating={review.rating} />
                      <span>{review.updatedAt ? `Edited ${formatDate(review.updatedAt)}` : `Written ${formatDate(review.createdAt)}`}</span>
                      {review.verifiedPurchase ? <span className="font-medium text-success">Verified purchase</span> : null}
                      <span className={isHidden ? "font-medium text-destructive" : undefined}>{isHidden ? "Hidden by a moderator" : "Published"}</span>
                    </div>
                  </div>
                </div>

                {editingId === review.id ? (
                  <div className="mt-4">
                    <ReviewForm mode="edit" initial={{ rating: review.rating, body: review.body }} verified={hasPurchased(orders, review.productId)} onSubmit={(values) => save(review.id, review.productId, values)} onCancel={() => setEditingId(null)} />
                  </div>
                ) : (
                  <>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
                    {confirmId === review.id ? (
                      <div role="alertdialog" aria-label="Delete this review?" className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
                        <span className="mr-auto font-medium">Delete this review?</span>
                        <Button type="button" size="sm" variant="destructive" onClick={() => remove(review.id)}>
                          Delete
                        </Button>
                        <Button type="button" size="sm" variant="outline" autoFocus onClick={() => setConfirmId(null)}>
                          Keep
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => { setNotice(null); setEditingId(review.id); }} aria-label={`Edit your review of ${product?.title ?? `product ${review.productId}`}`}>
                          <Pencil aria-hidden="true" className="size-3.5" /> Edit
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setNotice(null); setConfirmId(review.id); }} aria-label={`Delete your review of ${product?.title ?? `product ${review.productId}`}`}>
                          <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
