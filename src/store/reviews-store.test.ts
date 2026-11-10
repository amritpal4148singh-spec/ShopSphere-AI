import { REVIEW_STORAGE_KEY, loadReviewsData } from "@/lib/review-storage";
import { useReviewsStore } from "./reviews-store";

const input = { productId: 7, authorId: "u1", authorName: "Uma", rating: 4, body: "Works well, would buy again.", verifiedPurchase: true };

function reset() {
  localStorage.clear();
  useReviewsStore.setState({ status: "idle", reviews: [], votes: {}, hidden: {}, saveFailed: false });
}
beforeEach(reset);

describe("useReviewsStore", () => {
  it("is idle with nothing until hydrated, then reads this device's reviews", () => {
    expect(useReviewsStore.getState().status).toBe("idle");
    useReviewsStore.getState().hydrate();
    useReviewsStore.getState().submit(input);
    useReviewsStore.setState({ status: "idle", reviews: [] });
    useReviewsStore.getState().hydrate();
    expect(useReviewsStore.getState().reviews).toHaveLength(1);
  });

  it("saves a submitted review to storage and refuses a second one for the same product", () => {
    useReviewsStore.getState().hydrate();
    expect(useReviewsStore.getState().submit(input)).toBe("added");
    expect(useReviewsStore.getState().submit(input)).toBe("duplicate");
    expect(loadReviewsData().reviews).toHaveLength(1);
    expect(useReviewsStore.getState().reviews[0]).toMatchObject({ authorId: "u1", rating: 4, verifiedPurchase: true });
  });

  it("edits and removes only the author's own review", () => {
    const store = useReviewsStore.getState();
    store.hydrate();
    store.submit(input);
    const id = useReviewsStore.getState().reviews[0]!.id;
    expect(store.edit(id, "other", { rating: 1, body: "Hijacked review text.", verifiedPurchase: false })).toBe("missing");
    expect(store.edit(id, "u1", { rating: 2, body: "Changed my mind a bit.", verifiedPurchase: true })).toBe("edited");
    expect(useReviewsStore.getState().reviews[0]).toMatchObject({ rating: 2, body: "Changed my mind a bit." });
    store.remove(id, "other");
    expect(useReviewsStore.getState().reviews).toHaveLength(1);
    store.remove(id, "u1");
    expect(useReviewsStore.getState().reviews).toHaveLength(0);
    expect(loadReviewsData().reviews).toHaveLength(0);
  });

  it("stores votes and moderation", () => {
    const store = useReviewsStore.getState();
    store.hydrate();
    store.vote("guest", "s1", "helpful");
    store.hide({ reviewId: "s1", productId: 7, source: "sample", authorName: "Meera", rating: 4, body: "Nice" });
    expect(loadReviewsData().votes).toEqual({ guest: { s1: "helpful" } });
    expect(Object.keys(loadReviewsData().hidden)).toEqual(["s1"]);
    store.restore("s1");
    expect(loadReviewsData().hidden).toEqual({});
  });

  it("re-reads storage before writing, so a change made in another tab is kept", () => {
    const store = useReviewsStore.getState();
    store.hydrate();
    store.submit(input);
    // Another tab adds a review straight into storage.
    const stored = loadReviewsData();
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ ...stored, reviews: [...stored.reviews, { ...stored.reviews[0], id: "from-tab-2", authorId: "u2" }] }));
    store.vote("guest", "x", "helpful");
    expect(loadReviewsData().reviews.map((review) => review.id)).toContain("from-tab-2");
  });

  it("follows another tab through reload, but only after hydrating", () => {
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ reviews: [], votes: { a: { r: "helpful" } }, hidden: {} }));
    useReviewsStore.getState().reload();
    expect(useReviewsStore.getState().votes).toEqual({});
    useReviewsStore.getState().hydrate();
    localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({ reviews: [], votes: { b: { r: "helpful" } }, hidden: {} }));
    useReviewsStore.getState().reload();
    expect(useReviewsStore.getState().votes).toEqual({ b: { r: "helpful" } });
  });

  it("flags a write the browser refused, and keeps the change for this visit", () => {
    const store = useReviewsStore.getState();
    store.hydrate();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    store.submit(input);
    expect(useReviewsStore.getState().saveFailed).toBe(true);
    expect(useReviewsStore.getState().reviews).toHaveLength(1);
    spy.mockRestore();
    store.vote("guest", "x", "helpful");
    expect(useReviewsStore.getState().saveFailed).toBe(false);
  });
});
