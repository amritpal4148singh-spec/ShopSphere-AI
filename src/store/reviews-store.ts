import { create } from "zustand";

import { loadReviewsData, saveReviewsData } from "@/lib/review-storage";
import {
  EMPTY_REVIEWS_DATA,
  addShopperReview,
  castVote,
  editShopperReview,
  hideReview,
  newReviewId,
  removeShopperReview,
  restoreReview,
  type NewShopperReview,
} from "@/utils/reviews";
import type { HiddenReview, ReviewsData, VoteChoice } from "@/types/review";

/**
 * Reviews written, voted on and moderated on this device (PRD 5.10, 10.2). Like the cart, every change re-reads
 * the stored data first, so a second tab's changes are never overwritten with stale data. Reviews that come from the
 * product API or the sample fixture are not stored here; only shopper reviews, votes and moderation are.
 */
interface ReviewsState extends ReviewsData {
  /** "idle" until storage has been read after mount, so server and first client render match. */
  status: "idle" | "ready";
  /** True when the last write was refused by the browser (private mode, full storage): changes last only this visit. */
  saveFailed: boolean;
  hydrate: () => void;
  reload: () => void;
  submit: (input: NewShopperReview) => "added" | "duplicate";
  edit: (reviewId: string, authorId: string, changes: { rating: number; body: string; verifiedPurchase: boolean }) => "edited" | "missing";
  remove: (reviewId: string, authorId: string) => void;
  vote: (voterKey: string, reviewId: string, choice: VoteChoice) => void;
  hide: (entry: Omit<HiddenReview, "hiddenAt">) => void;
  restore: (reviewId: string) => void;
}

function dataOf(state: ReviewsData): ReviewsData {
  return { reviews: state.reviews, votes: state.votes, hidden: state.hidden };
}

export const useReviewsStore = create<ReviewsState>()((set, get) => {
  function fresh(): ReviewsData {
    return get().status === "ready" ? loadReviewsData() : dataOf(get());
  }

  function commit(data: ReviewsData): void {
    const saved = saveReviewsData(data);
    set({ ...data, saveFailed: !saved });
  }

  return {
    status: "idle",
    saveFailed: false,
    ...EMPTY_REVIEWS_DATA,

    hydrate: () => set({ status: "ready", saveFailed: false, ...loadReviewsData() }),

    reload: () => {
      if (get().status === "ready") set({ ...loadReviewsData() });
    },

    submit: (input) => {
      const result = addShopperReview(fresh(), input, Date.now(), newReviewId(Date.now()));
      if (result.outcome === "added") commit(result.data);
      return result.outcome;
    },

    edit: (reviewId, authorId, changes) => {
      const result = editShopperReview(fresh(), reviewId, authorId, changes, Date.now());
      if (result.outcome === "edited") commit(result.data);
      return result.outcome;
    },

    remove: (reviewId, authorId) => commit(removeShopperReview(fresh(), reviewId, authorId)),

    vote: (voterKey, reviewId, choice) => commit(castVote(fresh(), voterKey, reviewId, choice)),

    hide: (entry) => commit(hideReview(fresh(), entry, Date.now())),

    restore: (reviewId) => commit(restoreReview(fresh(), reviewId)),
  };
});
