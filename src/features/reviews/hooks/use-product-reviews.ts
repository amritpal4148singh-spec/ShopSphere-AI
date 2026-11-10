import { useMemo } from "react";

import { SAMPLE_REVIEWS } from "@/data/review-data";
import { useReviewsStore } from "@/store/reviews-store";
import { buildReviews, summarizeReviews, visibleReviews } from "@/utils/reviews";
import type { CatalogueReview, Review, ReviewSummary } from "@/types/review";

export interface ProductReviewsState {
  /** False until local storage has been read after mount. */
  ready: boolean;
  /** Every review including hidden ones (moderators see these). */
  all: Review[];
  /** What shoppers see: hidden reviews removed. */
  visible: Review[];
  summary: ReviewSummary;
}

/**
 * The reviews of one product from all three sources (PRD 5.10, 10.2): the product API's reviews, the sample
 * fixture, and reviews written on this device. The summary counts only what shoppers can see.
 */
export function useProductReviews(productId: number, catalogue: readonly CatalogueReview[]): ProductReviewsState {
  const status = useReviewsStore((state) => state.status);
  const reviews = useReviewsStore((state) => state.reviews);
  const votes = useReviewsStore((state) => state.votes);
  const hidden = useReviewsStore((state) => state.hidden);

  const all = useMemo(
    () => buildReviews({ productId, catalogue, sample: SAMPLE_REVIEWS, data: { reviews, votes, hidden } }),
    [productId, catalogue, reviews, votes, hidden],
  );
  const visible = useMemo(() => visibleReviews(all), [all]);
  const summary = useMemo(() => summarizeReviews(visible), [visible]);

  return { ready: status === "ready", all, visible, summary };
}

/** Just the summary, for the rating line at the top of a product page. */
export function useReviewSummary(productId: number, catalogue: readonly CatalogueReview[]): ReviewSummary {
  return useProductReviews(productId, catalogue).summary;
}
