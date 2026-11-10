/** Where a review came from (PRD 10.2: reviews are local mock JSON plus local persistence). */
export type ReviewSource = "catalogue" | "sample" | "shopper";

/** A review as DummyJSON reports it on the product detail response. Defensive: the text may be empty. */
export interface CatalogueReview {
  /** Whole stars, 1 to 5. */
  rating: number;
  comment: string;
  /** Epoch milliseconds, or null when the API gives no usable date. */
  date: number | null;
  reviewerName: string;
}

/** A review written on this device by a signed-in customer (persisted locally). */
export interface ShopperReview {
  id: string;
  productId: number;
  authorId: string;
  authorName: string;
  /** Whole stars, 1 to 5. */
  rating: number;
  body: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds of the last edit, or null if never edited. */
  updatedAt: number | null;
  /** Derived from the author's local order history when the review was written (PRD 5.10). */
  verifiedPurchase: boolean;
}

/** A sample review from `src/data/reviews.json` (PRD 10.3). */
export interface SampleReview {
  id: string;
  productId: number;
  authorName: string;
  rating: number;
  body: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  verifiedPurchase: boolean;
  helpful: number;
  notHelpful: number;
}

export type VoteChoice = "helpful" | "not-helpful";

/** voter key (user id or "guest") -> review id -> that voter's choice. */
export type VoteMap = Record<string, Record<string, VoteChoice>>;

/** What a moderator hid, kept as a snapshot so the admin list can show and restore it. */
export interface HiddenReview {
  reviewId: string;
  productId: number;
  source: ReviewSource;
  authorName: string;
  rating: number;
  body: string;
  /** Epoch milliseconds. */
  hiddenAt: number;
}

/** Everything the reviews module persists on this device. */
export interface ReviewsData {
  reviews: ShopperReview[];
  votes: VoteMap;
  hidden: Record<string, HiddenReview>;
}

/** A review ready to display: every source normalized, with vote totals and moderation state applied. */
export interface Review {
  id: string;
  productId: number;
  source: ReviewSource;
  /** Account id for shopper reviews; null for catalogue and sample reviews. */
  authorId: string | null;
  authorName: string;
  rating: number;
  body: string;
  createdAt: number | null;
  updatedAt: number | null;
  verifiedPurchase: boolean;
  helpful: number;
  notHelpful: number;
  hidden: boolean;
}

export type ReviewSort = "recent" | "highest" | "lowest" | "helpful";

export interface ReviewSummary {
  count: number;
  /** Mean rating (0 when there are no reviews). */
  average: number;
  /** Number of reviews per star value. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}
