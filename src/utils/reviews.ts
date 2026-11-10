import type {
  CatalogueReview,
  HiddenReview,
  Review,
  ReviewSort,
  ReviewsData,
  ReviewSummary,
  SampleReview,
  ShopperReview,
  VoteChoice,
} from "@/types/review";
import type { Order } from "@/types/order";

/** Character policy for a written review (PRD 5.10: minimum and maximum). Counted after normalizing. */
export const REVIEW_MIN_LENGTH = 10;
export const REVIEW_MAX_LENGTH = 1000;

/** Votes by someone who is not signed in are kept under this key. */
export const GUEST_VOTER = "guest";

export const EMPTY_REVIEWS_DATA: ReviewsData = { reviews: [], votes: {}, hidden: {} };

export const SORT_LABELS: Record<ReviewSort, string> = {
  recent: "Most recent",
  highest: "Highest rated",
  lowest: "Lowest rated",
  helpful: "Most helpful",
};

/* ------------------------------------------------------------------ validation */

/**
 * Normalizes review text before it is validated and stored: unified line breaks, no control characters,
 * at most one blank line in a row, trimmed. React escapes the text on display, so nothing else is rewritten.
 */
export function normalizeReviewText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface ReviewInput {
  rating: number | null;
  body: string;
}

export type ReviewValidation =
  | { ok: true; value: { rating: number; body: string } }
  | { ok: false; errors: { rating?: string; body?: string } };

export function validateReview(input: ReviewInput): ReviewValidation {
  const errors: { rating?: string; body?: string } = {};
  const body = normalizeReviewText(input.body);

  if (input.rating === null || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    errors.rating = "Choose a rating from 1 to 5 stars.";
  }
  if (body.length === 0) {
    errors.body = "Write a few words about the product.";
  } else if (body.length < REVIEW_MIN_LENGTH) {
    errors.body = `Your review needs at least ${REVIEW_MIN_LENGTH} characters (you have ${body.length}).`;
  } else if (body.length > REVIEW_MAX_LENGTH) {
    errors.body = `Your review can be at most ${REVIEW_MAX_LENGTH} characters (you have ${body.length}).`;
  }

  if (errors.rating || errors.body || input.rating === null) return { ok: false, errors };
  return { ok: true, value: { rating: input.rating, body } };
}

/** "Verified purchase" is derived from the customer's local order history (PRD 5.10), not from a payment provider. */
export function hasPurchased(orders: ReadonlyArray<Pick<Order, "items">>, productId: number): boolean {
  return orders.some((order) => order.items.some((item) => item.productId === productId));
}

/* ------------------------------------------------------------------ state changes (pure, immutable) */

export interface NewShopperReview {
  productId: number;
  authorId: string;
  authorName: string;
  rating: number;
  body: string;
  verifiedPurchase: boolean;
}

export function newReviewId(now: number, random: () => number = Math.random): string {
  return `shopper-${now.toString(36)}-${Math.floor(random() * 36 ** 4).toString(36).padStart(4, "0")}`;
}

/** One review per customer per product: a second one is refused (the customer edits the first instead). */
export function addShopperReview(
  data: ReviewsData,
  input: NewShopperReview,
  now: number,
  id: string,
): { data: ReviewsData; outcome: "added" | "duplicate" } {
  if (data.reviews.some((review) => review.productId === input.productId && review.authorId === input.authorId)) {
    return { data, outcome: "duplicate" };
  }
  const review: ShopperReview = { id, ...input, createdAt: now, updatedAt: null };
  return { data: { ...data, reviews: [review, ...data.reviews] }, outcome: "added" };
}

export function editShopperReview(
  data: ReviewsData,
  reviewId: string,
  authorId: string,
  changes: { rating: number; body: string; verifiedPurchase: boolean },
  now: number,
): { data: ReviewsData; outcome: "edited" | "missing" } {
  if (!data.reviews.some((review) => review.id === reviewId && review.authorId === authorId)) return { data, outcome: "missing" };
  return {
    data: { ...data, reviews: data.reviews.map((review) => (review.id === reviewId ? { ...review, ...changes, updatedAt: now } : review)) },
    outcome: "edited",
  };
}

function withoutReviewId<T>(record: Record<string, T>, reviewId: string): Record<string, T> {
  const { [reviewId]: _dropped, ...rest } = record;
  void _dropped;
  return rest;
}

/** Removes the author's own review together with the votes on it. */
export function removeShopperReview(data: ReviewsData, reviewId: string, authorId: string): ReviewsData {
  if (!data.reviews.some((review) => review.id === reviewId && review.authorId === authorId)) return data;
  return {
    reviews: data.reviews.filter((review) => review.id !== reviewId),
    votes: Object.fromEntries(Object.entries(data.votes).map(([voter, choices]) => [voter, withoutReviewId(choices, reviewId)])),
    hidden: withoutReviewId(data.hidden, reviewId),
  };
}

/** Records a vote; voting the same way again takes it back, and the other way switches it. Nobody votes on their own review. */
export function castVote(data: ReviewsData, voterKey: string, reviewId: string, choice: VoteChoice): ReviewsData {
  if (data.reviews.some((review) => review.id === reviewId && review.authorId === voterKey)) return data;
  const mine = data.votes[voterKey] ?? {};
  const next = mine[reviewId] === choice ? withoutReviewId(mine, reviewId) : { ...mine, [reviewId]: choice };
  return { ...data, votes: { ...data.votes, [voterKey]: next } };
}

export function hideReview(data: ReviewsData, entry: Omit<HiddenReview, "hiddenAt">, now: number): ReviewsData {
  return { ...data, hidden: { ...data.hidden, [entry.reviewId]: { ...entry, hiddenAt: now } } };
}

export function restoreReview(data: ReviewsData, reviewId: string): ReviewsData {
  return reviewId in data.hidden ? { ...data, hidden: withoutReviewId(data.hidden, reviewId) } : data;
}

/* ------------------------------------------------------------------ building the list a page shows */

export function catalogueReviewId(productId: number, index: number): string {
  return `catalogue-${productId}-${index}`;
}

interface Tally {
  helpful: number;
  notHelpful: number;
}

function tallyVotes(votes: ReviewsData["votes"]): Map<string, Tally> {
  const tally = new Map<string, Tally>();
  for (const choices of Object.values(votes)) {
    for (const [reviewId, choice] of Object.entries(choices)) {
      const entry = tally.get(reviewId) ?? { helpful: 0, notHelpful: 0 };
      if (choice === "helpful") entry.helpful += 1;
      else entry.notHelpful += 1;
      tally.set(reviewId, entry);
    }
  }
  return tally;
}

function fromCatalogue(productId: number, review: CatalogueReview, index: number): Review {
  return {
    id: catalogueReviewId(productId, index),
    productId,
    source: "catalogue",
    authorId: null,
    authorName: review.reviewerName,
    rating: review.rating,
    body: review.comment,
    createdAt: review.date,
    updatedAt: null,
    verifiedPurchase: false,
    helpful: 0,
    notHelpful: 0,
    hidden: false,
  };
}

function fromSample(review: SampleReview): Review {
  const date = Date.parse(review.date);
  return {
    id: review.id,
    productId: review.productId,
    source: "sample",
    authorId: null,
    authorName: review.authorName,
    rating: review.rating,
    body: review.body,
    createdAt: Number.isFinite(date) ? date : null,
    updatedAt: null,
    verifiedPurchase: review.verifiedPurchase,
    helpful: review.helpful,
    notHelpful: review.notHelpful,
    hidden: false,
  };
}

function fromShopper(review: ShopperReview): Review {
  return { ...review, source: "shopper", hidden: false, helpful: 0, notHelpful: 0 };
}

function applyState(review: Review, data: ReviewsData, tally: Map<string, Tally>): Review {
  const votes = tally.get(review.id);
  return {
    ...review,
    helpful: review.helpful + (votes?.helpful ?? 0),
    notHelpful: review.notHelpful + (votes?.notHelpful ?? 0),
    hidden: review.id in data.hidden,
  };
}

/**
 * Every review of one product, whatever its source (PRD 5.10, 10.2): the product API's own reviews, the sample
 * fixture, and reviews written on this device, with vote totals and moderation applied. Hidden ones are included
 * and flagged; `visibleReviews` filters them.
 */
export function buildReviews(input: {
  productId: number;
  catalogue: readonly CatalogueReview[];
  sample: readonly SampleReview[];
  data: ReviewsData;
}): Review[] {
  const { productId, catalogue, sample, data } = input;
  const tally = tallyVotes(data.votes);
  return [
    ...catalogue.map((review, index) => fromCatalogue(productId, review, index)),
    ...sample.filter((review) => review.productId === productId).map(fromSample),
    ...data.reviews.filter((review) => review.productId === productId).map(fromShopper),
  ].map((review) => applyState(review, data, tally));
}

export function visibleReviews(reviews: readonly Review[]): Review[] {
  return reviews.filter((review) => !review.hidden);
}

/**
 * Every review the app can list without a product page (the admin moderation screen): sample reviews, reviews written
 * on this device, and anything hidden from the product API's reviews (kept as a snapshot so it can be restored).
 */
export function collectModerationReviews(sample: readonly SampleReview[], data: ReviewsData): Review[] {
  const tally = tallyVotes(data.votes);
  const known = new Set<string>([...sample.map((review) => review.id), ...data.reviews.map((review) => review.id)]);
  const snapshots: Review[] = Object.values(data.hidden)
    .filter((entry) => !known.has(entry.reviewId))
    .map((entry) => ({
      id: entry.reviewId,
      productId: entry.productId,
      source: entry.source,
      authorId: null,
      authorName: entry.authorName,
      rating: entry.rating,
      body: entry.body,
      createdAt: null,
      updatedAt: null,
      verifiedPurchase: false,
      helpful: 0,
      notHelpful: 0,
      hidden: true,
    }));
  return [...sample.map(fromSample), ...data.reviews.map(fromShopper), ...snapshots].map((review) => applyState(review, data, tally));
}

/* ------------------------------------------------------------------ summary and sorting */

export function summarizeReviews(reviews: readonly Review[]): ReviewSummary {
  const distribution: ReviewSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const review of reviews) {
    distribution[review.rating as 1 | 2 | 3 | 4 | 5] += 1;
    total += review.rating;
  }
  return { count: reviews.length, average: reviews.length === 0 ? 0 : total / reviews.length, distribution };
}

const byRecent = (a: Review, b: Review) => (b.createdAt ?? 0) - (a.createdAt ?? 0);

/** Sorted copy (PRD 5.10). Ties fall back to most recent, so the order is stable and predictable. */
export function sortReviews(reviews: readonly Review[], sort: ReviewSort): Review[] {
  const compare: Record<ReviewSort, (a: Review, b: Review) => number> = {
    recent: byRecent,
    highest: (a, b) => b.rating - a.rating || byRecent(a, b),
    lowest: (a, b) => a.rating - b.rating || byRecent(a, b),
    helpful: (a, b) => b.helpful - a.helpful || byRecent(a, b),
  };
  return [...reviews].sort(compare[sort]);
}

/** Share of reviews at a star value, as a whole percentage (0 when there are no reviews). */
export function percentOf(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}
