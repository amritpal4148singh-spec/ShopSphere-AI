import { makeOrder } from "@/test/orders";
import type { CatalogueReview, ReviewsData, SampleReview } from "@/types/review";
import {
  EMPTY_REVIEWS_DATA,
  REVIEW_MAX_LENGTH,
  REVIEW_MIN_LENGTH,
  addShopperReview,
  buildReviews,
  castVote,
  catalogueReviewId,
  collectModerationReviews,
  editShopperReview,
  hasPurchased,
  hideReview,
  normalizeReviewText,
  percentOf,
  removeShopperReview,
  restoreReview,
  sortReviews,
  summarizeReviews,
  validateReview,
  visibleReviews,
} from "./reviews";

const GOOD = "This is a perfectly fine review text.";

const catalogue: CatalogueReview[] = [
  { rating: 5, comment: "Great", date: Date.UTC(2026, 0, 10), reviewerName: "Asha" },
  { rating: 2, comment: "Meh", date: Date.UTC(2026, 0, 20), reviewerName: "Ravi" },
];
const sample: SampleReview[] = [
  { id: "s1", productId: 7, authorName: "Meera", rating: 4, body: "Nice", date: "2026-02-01", verifiedPurchase: true, helpful: 5, notHelpful: 1 },
  { id: "s2", productId: 8, authorName: "Other product", rating: 1, body: "x", date: "2026-02-02", verifiedPurchase: false, helpful: 0, notHelpful: 0 },
];
const input = { productId: 7, authorId: "u1", authorName: "Uma", rating: 3, body: GOOD, verifiedPurchase: false };

function withReview(data: ReviewsData = EMPTY_REVIEWS_DATA) {
  return addShopperReview(data, input, 1_700_000_000_000, "shopper-1").data;
}

describe("validateReview (PRD 5.10 character policy)", () => {
  it("accepts a rating with a review inside the limits and returns the normalized text", () => {
    expect(validateReview({ rating: 4, body: `  ${GOOD}  ` })).toEqual({ ok: true, value: { rating: 4, body: GOOD } });
  });

  it("asks for a rating when none is chosen or the value is not 1 to 5", () => {
    for (const rating of [null, 0, 6, 2.5]) {
      const result = validateReview({ rating, body: GOOD });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.rating).toMatch(/1 to 5/);
    }
  });

  it("enforces the minimum length, counting characters after trimming", () => {
    const short = "x".repeat(REVIEW_MIN_LENGTH - 1);
    const result = validateReview({ rating: 5, body: `   ${short}   ` });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.body).toContain(`at least ${REVIEW_MIN_LENGTH}`);
    expect(validateReview({ rating: 5, body: "x".repeat(REVIEW_MIN_LENGTH) }).ok).toBe(true);
  });

  it("enforces the maximum length", () => {
    expect(validateReview({ rating: 5, body: "x".repeat(REVIEW_MAX_LENGTH) }).ok).toBe(true);
    const result = validateReview({ rating: 5, body: "x".repeat(REVIEW_MAX_LENGTH + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.body).toContain(`at most ${REVIEW_MAX_LENGTH}`);
  });

  it("treats an empty or whitespace-only review as missing, and reports both problems together", () => {
    const result = validateReview({ rating: null, body: "   \n  " });
    expect(result).toEqual({ ok: false, errors: { rating: expect.any(String), body: "Write a few words about the product." } });
  });
});

describe("normalizeReviewText", () => {
  it("unifies line breaks, removes control characters and collapses long blank runs", () => {
    expect(normalizeReviewText("a\r\nb\u0000c\n\n\n\nd")).toBe("a\nbc\n\nd");
  });

  it("leaves markup untouched, because React escapes it on display (no raw HTML is ever injected)", () => {
    expect(normalizeReviewText('<img src=x onerror="alert(1)">')).toBe('<img src=x onerror="alert(1)">');
  });
});

describe("hasPurchased (verified purchase comes from local order history)", () => {
  it("is true only when an order contains the product", () => {
    const orders = [makeOrder()];
    expect(hasPurchased(orders, 1)).toBe(true);
    expect(hasPurchased(orders, 2)).toBe(true);
    expect(hasPurchased(orders, 99)).toBe(false);
    expect(hasPurchased([], 1)).toBe(false);
  });
});

describe("shopper review changes", () => {
  it("adds a review, newest first, with its creation time", () => {
    const data = withReview();
    expect(data.reviews).toEqual([{ id: "shopper-1", ...input, createdAt: 1_700_000_000_000, updatedAt: null }]);
  });

  it("refuses a second review of the same product by the same customer", () => {
    const result = addShopperReview(withReview(), input, 1, "shopper-2");
    expect(result.outcome).toBe("duplicate");
    expect(result.data.reviews).toHaveLength(1);
    // A different customer, or a different product, is fine.
    expect(addShopperReview(withReview(), { ...input, authorId: "u2" }, 1, "shopper-3").outcome).toBe("added");
    expect(addShopperReview(withReview(), { ...input, productId: 8 }, 1, "shopper-4").outcome).toBe("added");
  });

  it("lets only the author edit, and stamps the edit time", () => {
    const edited = editShopperReview(withReview(), "shopper-1", "u1", { rating: 5, body: "Changed my mind, it is great.", verifiedPurchase: true }, 2_000);
    expect(edited.outcome).toBe("edited");
    expect(edited.data.reviews[0]).toMatchObject({ rating: 5, body: "Changed my mind, it is great.", verifiedPurchase: true, updatedAt: 2_000, createdAt: 1_700_000_000_000 });
    expect(editShopperReview(withReview(), "shopper-1", "someone-else", { rating: 1, body: GOOD, verifiedPurchase: false }, 2).outcome).toBe("missing");
  });

  it("lets only the author delete, and takes the votes on it along", () => {
    let data = castVote(withReview(), "u2", "shopper-1", "helpful");
    expect(removeShopperReview(data, "shopper-1", "intruder")).toBe(data);
    data = removeShopperReview(data, "shopper-1", "u1");
    expect(data.reviews).toEqual([]);
    expect(data.votes.u2).toEqual({});
  });
});

describe("castVote", () => {
  it("counts a vote, takes it back when repeated and switches when changed", () => {
    let data = castVote(EMPTY_REVIEWS_DATA, "u2", "r1", "helpful");
    expect(data.votes.u2).toEqual({ r1: "helpful" });
    data = castVote(data, "u2", "r1", "not-helpful");
    expect(data.votes.u2).toEqual({ r1: "not-helpful" });
    data = castVote(data, "u2", "r1", "not-helpful");
    expect(data.votes.u2).toEqual({});
  });

  it("ignores a customer voting on their own review", () => {
    const data = withReview();
    expect(castVote(data, "u1", "shopper-1", "helpful")).toBe(data);
  });
});

describe("moderation", () => {
  it("hides a review with a snapshot and restores it", () => {
    const entry = { reviewId: "x", productId: 7, source: "catalogue" as const, authorName: "A", rating: 1, body: "bad" };
    const hidden = hideReview(EMPTY_REVIEWS_DATA, entry, 5);
    expect(hidden.hidden.x).toEqual({ ...entry, hiddenAt: 5 });
    expect(restoreReview(hidden, "x").hidden).toEqual({});
    expect(restoreReview(EMPTY_REVIEWS_DATA, "nope")).toBe(EMPTY_REVIEWS_DATA);
  });
});

describe("buildReviews", () => {
  it("merges the product API reviews, the sample reviews of that product and the shopper's reviews", () => {
    const reviews = buildReviews({ productId: 7, catalogue, sample, data: withReview() });
    expect(reviews.map((review) => review.source)).toEqual(["catalogue", "catalogue", "sample", "shopper"]);
    expect(reviews.map((review) => review.id)).toEqual([catalogueReviewId(7, 0), catalogueReviewId(7, 1), "s1", "shopper-1"]);
    expect(reviews.every((review) => review.productId === 7)).toBe(true);
  });

  it("adds votes to the sample counts and flags hidden reviews", () => {
    let data = castVote(EMPTY_REVIEWS_DATA, "u1", "s1", "helpful");
    data = castVote(data, "guest", "s1", "helpful");
    data = castVote(data, "u3", "s1", "not-helpful");
    data = hideReview(data, { reviewId: "s1", productId: 7, source: "sample", authorName: "Meera", rating: 4, body: "Nice" }, 1);
    const review = buildReviews({ productId: 7, catalogue: [], sample, data })[0];
    expect(review).toMatchObject({ helpful: 7, notHelpful: 2, hidden: true, verifiedPurchase: true });
    expect(visibleReviews([review!])).toEqual([]);
  });

  it("marks only reviews with an order behind them as verified (shopper flag is kept as stored)", () => {
    const data = addShopperReview(EMPTY_REVIEWS_DATA, { ...input, verifiedPurchase: true }, 1, "v1").data;
    const [review] = buildReviews({ productId: 7, catalogue: [], sample: [], data });
    expect(review?.verifiedPurchase).toBe(true);
    expect(buildReviews({ productId: 7, catalogue, sample: [], data: EMPTY_REVIEWS_DATA }).every((r) => !r.verifiedPurchase)).toBe(true);
  });
});

describe("collectModerationReviews", () => {
  it("lists sample and shopper reviews plus snapshots of hidden product API reviews", () => {
    let data = withReview();
    data = hideReview(data, { reviewId: "catalogue-7-0", productId: 7, source: "catalogue", authorName: "Asha", rating: 5, body: "Great" }, 9);
    const all = collectModerationReviews(sample, data);
    expect(all.map((review) => review.id).sort()).toEqual(["catalogue-7-0", "s1", "s2", "shopper-1"]);
    expect(all.find((review) => review.id === "catalogue-7-0")).toMatchObject({ hidden: true, authorName: "Asha" });
  });
});

describe("summary and sorting (PRD 5.10)", () => {
  const reviews = buildReviews({ productId: 7, catalogue, sample, data: EMPTY_REVIEWS_DATA });

  it("computes the count, the average and the 5-to-1 distribution", () => {
    const summary = summarizeReviews(reviews);
    expect(summary.count).toBe(3);
    expect(summary.average).toBeCloseTo((5 + 2 + 4) / 3);
    expect(summary.distribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 1 });
  });

  it("has a zero average and an all-zero distribution for no reviews", () => {
    expect(summarizeReviews([])).toEqual({ count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });

  it("sorts by most recent, highest, lowest and most helpful", () => {
    const names = (sort: Parameters<typeof sortReviews>[1]) => sortReviews(reviews, sort).map((review) => review.authorName);
    expect(names("recent")).toEqual(["Meera", "Ravi", "Asha"]);
    expect(names("highest")).toEqual(["Asha", "Meera", "Ravi"]);
    expect(names("lowest")).toEqual(["Ravi", "Meera", "Asha"]);
    expect(names("helpful")[0]).toBe("Meera");
  });

  it("does not change the input order", () => {
    const before = reviews.map((review) => review.id);
    sortReviews(reviews, "lowest");
    expect(reviews.map((review) => review.id)).toEqual(before);
  });

  it("turns counts into whole percentages", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBe(0);
  });
});
