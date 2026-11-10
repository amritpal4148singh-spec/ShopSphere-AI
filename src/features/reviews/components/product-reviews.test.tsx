import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useOrdersStore } from "@/store/orders-store";
import { useReviewsStore } from "@/store/reviews-store";
import { ADMIN, CUSTOMER, signInAs } from "@/test/session";
import { makeOrder } from "@/test/orders";
import type { CatalogueReview } from "@/types/review";
import { ProductReviews } from "./product-reviews";

// Product 10 has four sample reviews in src/data/reviews.json (5, 4, 4 and 1 stars).
const PRODUCT_ID = 10;
const catalogue: CatalogueReview[] = [
  { rating: 5, comment: "Catalogue five-star review text.", date: Date.UTC(2026, 5, 1), reviewerName: "Catalogue Carl" },
];
const GOOD = "A thoughtful review that is long enough.";

function resetWorld() {
  localStorage.clear();
  useReviewsStore.setState({ status: "idle", reviews: [], votes: {}, hidden: {}, saveFailed: false });
  useReviewsStore.getState().hydrate();
  useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
  signInAs(null);
}
beforeEach(resetWorld);

const renderReviews = (id = PRODUCT_ID, reviews = catalogue) => render(<ProductReviews productId={id} catalogueReviews={reviews} />);
const reviewList = () => screen.getByRole("list", { name: "Reviews" });
const authors = () => within(reviewList()).getAllByRole("article").map((article) => article.getAttribute("aria-label")?.replace("Review by ", ""));

describe("ProductReviews: loading, summary and list", () => {
  it("shows a loading state until this device's reviews are read", () => {
    useReviewsStore.setState({ status: "idle" });
    renderReviews();
    expect(screen.getByRole("status")).toHaveTextContent("Loading reviews");
    expect(screen.queryByRole("heading", { name: "Customer reviews" })).toBeNull();
  });

  it("merges catalogue and sample reviews into one summary with a rating distribution", () => {
    renderReviews();
    // 1 catalogue (5) + 4 sample reviews for product 10 (4, 4... see fixture) -> count from the list itself.
    const count = within(reviewList()).getAllByRole("article").length;
    expect(screen.getByText(`Based on ${count} reviews`)).toBeInTheDocument();
    const breakdown = screen.getByRole("list", { name: "Rating breakdown" });
    expect(within(breakdown).getAllByRole("listitem")).toHaveLength(5);
    expect(within(breakdown).getByText(/^1 star$/)).toBeInTheDocument();
    expect(screen.getByTestId("review-average").textContent).toMatch(/^\d\.\d$/);
  });

  it("makes the distribution bars proportional to the counts", () => {
    renderReviews();
    const widths = [5, 4, 3, 2, 1].map((star) => screen.getByTestId(`bar-${star}`).style.width);
    expect(widths.every((width) => /^\d+%$/.test(width))).toBe(true);
    expect(widths[2]).toBe("0%");
  });

  it("shows an empty state when a product has no reviews", () => {
    renderReviews(999, []);
    expect(screen.getByRole("heading", { name: "No reviews yet" })).toBeInTheDocument();
    expect(screen.queryByTestId("review-average")).toBeNull();
    expect(screen.queryByRole("list", { name: "Reviews" })).toBeNull();
  });

  it("sorts by highest, lowest, most recent and most helpful", async () => {
    const user = userEvent.setup();
    renderReviews();
    const select = screen.getByLabelText("Sort reviews");
    const ratingOf = (article: HTMLElement) => Number(within(article).getByRole("img").getAttribute("aria-label")?.match(/\d/)?.[0]);
    const ratings = () => within(reviewList()).getAllByRole("article").map(ratingOf);

    await user.selectOptions(select, "highest");
    expect(ratings()).toEqual([...ratings()].sort((a, b) => b - a));
    await user.selectOptions(select, "lowest");
    expect(ratings()).toEqual([...ratings()].sort((a, b) => a - b));
    await user.selectOptions(select, "helpful");
    // Sample review with the most helpful votes on product 10 is the 1-star one (12 votes) in the fixture.
    expect(within(reviewList()).getAllByRole("article")[0]).toHaveTextContent(/Deepa Nair/);
    await user.selectOptions(select, "recent");
    expect(authors()[0]).toBe("Sana Qureshi");
  });

  it("pages long lists with a show-more button", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, index): CatalogueReview => ({ rating: 3, comment: `Review number ${index}`, date: index, reviewerName: `Reviewer ${index}` }));
    renderReviews(999, many);
    expect(within(reviewList()).getAllByRole("article")).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Show more reviews (7 remaining)" }));
    expect(within(reviewList()).getAllByRole("article")).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: /Show more reviews/ }));
    expect(within(reviewList()).getAllByRole("article")).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Show more reviews/ })).toBeNull();
  });

  it("shows a verified-purchase marker only on verified reviews", () => {
    renderReviews();
    const deepa = screen.getByRole("article", { name: "Review by Deepa Nair" });
    const vikram = screen.getByRole("article", { name: "Review by Vikram Rao" });
    expect(within(deepa).getByText("Verified purchase")).toBeInTheDocument();
    expect(within(vikram).queryByText("Verified purchase")).toBeNull();
  });

  it("renders review text as plain text, never as markup (PRD 13)", () => {
    renderReviews(999, [{ rating: 4, comment: '<img src=x onerror="alert(1)"><b>bold</b>', date: 1, reviewerName: "<script>x</script>" }]);
    expect(screen.getByText('<img src=x onerror="alert(1)"><b>bold</b>')).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });

  it("explains how a reviewer with a rating but no text appears", () => {
    renderReviews(999, [{ rating: 4, comment: "", date: null, reviewerName: "Quiet Quentin" }]);
    expect(screen.getByText("This reviewer left a rating without a written review.")).toBeInTheDocument();
    expect(screen.getByText("Date unavailable")).toBeInTheDocument();
  });
});

describe("ProductReviews: helpful voting", () => {
  it("counts a vote, lets it be taken back and switched, and remembers it", async () => {
    const user = userEvent.setup();
    renderReviews();
    const card = () => screen.getByRole("article", { name: "Review by Sana Qureshi" });
    const helpful = () => within(card()).getByRole("button", { name: /^Helpful/ });
    const notHelpful = () => within(card()).getByRole("button", { name: /^Not helpful/ });

    expect(helpful()).toHaveTextContent("Helpful (8)");
    await user.click(helpful());
    expect(helpful()).toHaveTextContent("Helpful (9)");
    expect(helpful()).toHaveAttribute("aria-pressed", "true");
    await user.click(notHelpful());
    expect(helpful()).toHaveTextContent("Helpful (8)");
    expect(notHelpful()).toHaveTextContent("Not helpful (1)");
    await user.click(notHelpful());
    expect(notHelpful()).toHaveAttribute("aria-pressed", "false");
    expect(JSON.parse(localStorage.getItem("shopsphere.reviews.v1")!).votes.guest).toEqual({});
  });
});

describe("ProductReviews: guest and administrator", () => {
  it("invites a guest to sign in instead of showing the form", () => {
    renderReviews();
    const link = screen.getByRole("link", { name: "Sign in to write a review" });
    expect(link).toHaveAttribute("href", `/login?next=${encodeURIComponent(`/products/${PRODUCT_ID}`)}`);
    expect(screen.queryByRole("form", { name: "Write a review" })).toBeNull();
  });

  it("gives an administrator moderation controls, not a form, and no voting", async () => {
    signInAs(ADMIN);
    renderReviews();
    expect(screen.queryByRole("button", { name: "Submit review" })).toBeNull();
    expect(screen.getByText(/Administrators moderate reviews/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Helpful/ })).toBeNull();
    expect(screen.getAllByText("Local simulation").length).toBeGreaterThan(0);
  });

  it("hides a review from the summary and from shoppers, and restores it", async () => {
    const user = userEvent.setup();
    signInAs(ADMIN);
    const view = renderReviews();
    const before = screen.getByText(/^Based on \d+ reviews$/).textContent;

    await user.click(within(screen.getByRole("article", { name: "Review by Deepa Nair" })).getByRole("button", { name: /Hide review/ }));
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Review hidden from shoppers (local simulation).");
    expect(screen.getByRole("article", { name: "Review by Deepa Nair" })).toHaveAttribute("data-hidden", "true");
    expect(screen.getByText(/^Based on \d+ reviews$/).textContent).not.toBe(before);

    // A shopper no longer sees it.
    view.unmount();
    signInAs(null);
    const shopperView = renderReviews();
    expect(screen.queryByRole("article", { name: "Review by Deepa Nair" })).toBeNull();

    // Restoring it brings it back.
    shopperView.unmount();
    useReviewsStore.getState().restore(Object.keys(useReviewsStore.getState().hidden)[0]!);
    signInAs(ADMIN);
    renderReviews();
    expect(screen.getByRole("article", { name: "Review by Deepa Nair" })).toHaveAttribute("data-hidden", "false");
  });
});

describe("ProductReviews: customer writes, edits and deletes (PRD 5.10)", () => {
  async function writeReview(user: ReturnType<typeof userEvent.setup>, rating: number, text: string) {
    await user.click(screen.getByRole("radio", { name: `${rating} ${rating === 1 ? "star" : "stars"}` }));
    await user.type(screen.getByLabelText("Your review"), text);
    await user.click(screen.getByRole("button", { name: "Submit review" }));
  }

  it("validates inline: asks for a rating and text, then explains the length policy", async () => {
    const user = userEvent.setup();
    signInAs(CUSTOMER);
    renderReviews();

    await user.click(screen.getByRole("button", { name: "Submit review" }));
    expect(screen.getByText("Choose a rating from 1 to 5 stars.")).toBeInTheDocument();
    expect(screen.getByText("Write a few words about the product.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "1 star" })).toHaveFocus();
    expect(screen.getByLabelText("Your review")).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(screen.queryByText("Choose a rating from 1 to 5 stars.")).toBeNull();
    await user.type(screen.getByLabelText("Your review"), "short");
    await user.click(screen.getByRole("button", { name: "Submit review" }));
    expect(screen.getByText(/at least 10 characters \(you have 5\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Your review")).toHaveFocus();
    expect(useReviewsStore.getState().reviews).toHaveLength(0);
  });

  it("submits a review that then appears in the list, the summary and storage", async () => {
    const user = userEvent.setup();
    signInAs(CUSTOMER);
    renderReviews();
    const before = within(reviewList()).getAllByRole("article").length;

    await writeReview(user, 2, GOOD);
    expect(screen.getByText("Thank you. Your review was saved on this device.")).toBeInTheDocument();
    const mine = screen.getByRole("article", { name: "Review by Uma Customer" });
    expect(within(mine).getByText("Your review")).toBeInTheDocument();
    expect(within(mine).getByText(GOOD)).toBeInTheDocument();
    expect(screen.getByText(`Based on ${before + 1} reviews`)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("shopsphere.reviews.v1")!).reviews[0]).toMatchObject({ productId: PRODUCT_ID, authorId: CUSTOMER.id, rating: 2, verifiedPurchase: false });
    // One review per product: the form is replaced by guidance, and own reviews cannot be voted on.
    expect(screen.queryByRole("button", { name: "Submit review" })).toBeNull();
    expect(within(mine).queryByRole("button", { name: /^Helpful/ })).toBeNull();
  });

  it("marks the review as a verified purchase when the product is in the customer's order history", async () => {
    const user = userEvent.setup();
    signInAs(CUSTOMER);
    useOrdersStore.setState({ status: "ready", ownerId: CUSTOMER.id, orders: [makeOrder({ items: [{ productId: PRODUCT_ID, title: "Thing", thumbnail: null, variantLabel: null, quantity: 1, unitPrice: 100 }] })] });
    renderReviews();
    expect(screen.getByText(/will be marked as a verified purchase/)).toBeInTheDocument();

    await writeReview(user, 5, GOOD);
    expect(within(screen.getByRole("article", { name: "Review by Uma Customer" })).getByText("Verified purchase")).toBeInTheDocument();
  });

  it("tells the customer when it will not be verified", () => {
    signInAs(CUSTOMER);
    renderReviews();
    expect(screen.getByText(/will not be marked as a verified purchase/)).toBeInTheDocument();
  });

  it("edits the customer's own review and shows it as edited", async () => {
    const user = userEvent.setup();
    signInAs(CUSTOMER);
    renderReviews();
    await writeReview(user, 2, GOOD);

    await user.click(screen.getByRole("button", { name: "Edit your review" }));
    expect(screen.getByRole("heading", { name: "Edit your review" })).toBeInTheDocument();
    const text = screen.getByLabelText("Your review");
    expect(text).toHaveValue(GOOD);
    await user.clear(text);
    await user.type(text, "Updated opinion: it is quite good actually.");
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Your review was updated.")).toBeInTheDocument();
    const mine = screen.getByRole("article", { name: "Review by Uma Customer" });
    expect(within(mine).getByText("Updated opinion: it is quite good actually.")).toBeInTheDocument();
    expect(within(mine).getByText(/\(edited\)/)).toBeInTheDocument();
    expect(useReviewsStore.getState().reviews).toHaveLength(1);
  });

  it("can cancel an edit, and delete the review after confirming", async () => {
    const user = userEvent.setup();
    signInAs(CUSTOMER);
    renderReviews();
    await writeReview(user, 3, GOOD);

    await user.click(screen.getByRole("button", { name: "Edit your review" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("article", { name: "Review by Uma Customer" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete your review" }));
    await user.click(screen.getByRole("button", { name: "Keep it" }));
    expect(useReviewsStore.getState().reviews).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Delete your review" }));
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByText("Your review was deleted.")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Review by Uma Customer" })).toBeNull();
    expect(screen.getByRole("button", { name: "Submit review" })).toBeInTheDocument();
  });

  it("warns when the browser would not save the review", async () => {
    const user = userEvent.setup();
    signInAs(CUSTOMER);
    renderReviews();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await writeReview(user, 4, GOOD);
    expect(screen.getByRole("alert")).toHaveTextContent(/would not save this change/);
    spy.mockRestore();
  });
});
