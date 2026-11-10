import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { fetchCatalog } from "@/services/products";
import { useAddressStore } from "@/store/address-store";
import { useOrdersStore } from "@/store/orders-store";
import { useProfileStore } from "@/store/profile-store";
import { saveReviewsData } from "@/lib/review-storage";
import { useReviewsStore } from "@/store/reviews-store";
import { useViewedStore } from "@/store/viewed-store";
import { renderWithClient } from "@/test/render";
import { CUSTOMER, signInAs } from "@/test/session";
import { makeProduct } from "@/test/fixtures";
import { AddressesSection } from "./addresses-section";
import { MyReviewsSection } from "./my-reviews-section";
import { ProfileSection } from "./profile-section";
import { RecentlyViewedSection } from "./recently-viewed-section";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const lamp = makeProduct({ id: 11, title: "Brass Lamp" });
const mug = makeProduct({ id: 12, title: "Clay Mug" });

beforeEach(() => {
  localStorage.clear();
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue([lamp, mug]);
  signInAs(CUSTOMER);
  useProfileStore.setState({ status: "idle", ownerId: null, saved: null });
  useAddressStore.setState({ status: "idle", ownerId: null, addresses: [] });
  useReviewsStore.setState({ status: "ready", saveFailed: false, reviews: [], votes: {}, hidden: {} });
  useOrdersStore.setState({ status: "ready", ownerId: CUSTOMER.id, orders: [] });
  useViewedStore.setState({ status: "ready", items: [] });
});

describe("ProfileSection (PRD 5.7)", () => {
  it("shows the account's name and email, and saves edits with feedback", async () => {
    useProfileStore.getState().switchOwner(CUSTOMER.id);
    const user = userEvent.setup();
    renderWithClient(<ProfileSection />);

    expect(screen.getByLabelText("Full name")).toHaveValue("Uma Customer");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Uma K");
    await user.type(screen.getByLabelText("Mobile number (optional)"), "9876543210");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved on this device.");
    expect(useProfileStore.getState().saved).toMatchObject({ name: "Uma K", phone: "9876543210" });
  });

  it("shows field errors tied to their inputs and does not save invalid data", async () => {
    useProfileStore.getState().switchOwner(CUSTOMER.id);
    const user = userEvent.setup();
    renderWithClient(<ProfileSection />);

    await user.clear(screen.getByLabelText("Contact email"));
    await user.type(screen.getByLabelText("Contact email"), "not-an-email");
    await user.type(screen.getByLabelText("Mobile number (optional)"), "123");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(screen.getByLabelText("Contact email")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Mobile number (optional)")).toHaveAccessibleDescription("Enter a valid 10-digit mobile number.");
    expect(screen.getByRole("alert")).toHaveTextContent("Fix the highlighted fields");
    expect(useProfileStore.getState().saved).toBeNull();
  });

  it("cancel restores the saved values", async () => {
    useProfileStore.getState().switchOwner(CUSTOMER.id);
    const user = userEvent.setup();
    renderWithClient(<ProfileSection />);

    await user.type(screen.getByLabelText("Full name"), " Extra");
    expect(screen.getByLabelText("Full name")).toHaveValue("Uma Customer Extra");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Uma Customer");
  });

  it("rejects an avatar of the wrong type with a message", async () => {
    useProfileStore.getState().switchOwner(CUSTOMER.id);
    const user = userEvent.setup({ applyAccept: false });
    renderWithClient(<ProfileSection />);

    await user.upload(screen.getByLabelText("Choose profile picture"), new File(["x"], "notes.gif", { type: "image/gif" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("PNG, JPEG or WebP");
  });

  it("shows a skeleton until the profile is ready", () => {
    renderWithClient(<ProfileSection />);
    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
  });
});

describe("AddressesSection (PRD 5.7)", () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, line1: string, city = "Pune") => {
    await user.type(screen.getByLabelText("Street address"), line1);
    await user.type(screen.getByLabelText("City"), city);
    await user.type(screen.getByLabelText("State"), "Maharashtra");
    await user.type(screen.getByLabelText("PIN code"), "411001");
  };

  it("shows an empty state with a way to add the first address", async () => {
    useAddressStore.getState().switchOwner(CUSTOMER.id);
    const user = userEvent.setup();
    renderWithClient(<AddressesSection />);

    expect(screen.getByText("No saved addresses yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add your first address" }));
    expect(screen.getByRole("heading", { name: "New address" })).toBeInTheDocument();
  });

  it("validates, saves, and marks the first address as the default", async () => {
    useAddressStore.getState().switchOwner(CUSTOMER.id);
    const user = userEvent.setup();
    renderWithClient(<AddressesSection />);

    await user.click(screen.getByRole("button", { name: "Add your first address" }));
    await user.click(screen.getByRole("button", { name: "Save address" }));
    expect(screen.getByLabelText("Street address")).toHaveAttribute("aria-invalid", "true");
    expect(useAddressStore.getState().addresses).toHaveLength(0);

    await user.type(screen.getByLabelText("Label (optional)"), "Home");
    await fill(user, "12 Demo Street");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    const card = await screen.findByTestId("saved-address");
    expect(within(card).getByText("Home")).toBeInTheDocument();
    expect(within(card).getByText("Default")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Address saved.");
  });

  it("edits an address, changes the default, and deletes only after confirmation", async () => {
    useAddressStore.getState().switchOwner(CUSTOMER.id);
    useAddressStore.getState().add({ line1: "1 First Road", line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" }, "Home");
    useAddressStore.getState().add({ line1: "2 Second Road", line2: "", city: "Pune", state: "Maharashtra", pincode: "411002" }, "Office");
    const user = userEvent.setup();
    renderWithClient(<AddressesSection />);

    await user.click(screen.getByRole("button", { name: "Edit Office" }));
    await user.clear(screen.getByLabelText("City"));
    await user.type(screen.getByLabelText("City"), "Mumbai");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText(/Mumbai/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Make Office the default address" }));
    expect(screen.getAllByTestId("saved-address")[0]).toHaveTextContent("Office");
    expect(screen.getAllByTestId("saved-address")[0]).toHaveTextContent("Default");

    await user.click(screen.getByRole("button", { name: "Delete Home" }));
    expect(screen.getAllByTestId("saved-address")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getAllByTestId("saved-address")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Delete Home" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getAllByTestId("saved-address")).toHaveLength(1);
    expect(useAddressStore.getState().addresses[0]).toMatchObject({ label: "Office", isDefault: true });
  });

  it("explains a duplicate address instead of saving it twice", async () => {
    useAddressStore.getState().switchOwner(CUSTOMER.id);
    useAddressStore.getState().add({ line1: "12 Demo Street", line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" }, "Home");
    useAddressStore.getState().add({ line1: "9 Other Road", line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" }, "Work");
    const user = userEvent.setup();
    renderWithClient(<AddressesSection />);

    await user.click(screen.getByRole("button", { name: "Edit Work" }));
    await user.clear(screen.getByLabelText("Street address"));
    await user.type(screen.getByLabelText("Street address"), "12 Demo Street");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already saved");
  });
});

describe("MyReviewsSection (PRD 5.7)", () => {
  const mine = { id: "r1", productId: 11, authorId: CUSTOMER.id, authorName: CUSTOMER.name, rating: 4, body: "Warm light and well made.", createdAt: 1_700_000_000_000, updatedAt: null, verifiedPurchase: true };

  it("shows an empty state", async () => {
    renderWithClient(<MyReviewsSection />);
    expect(await screen.findByText("You have not written any reviews yet")).toBeInTheDocument();
  });

  it("lists only the customer's own reviews with their product, then edits and deletes them", async () => {
    saveReviewsData({ reviews: [mine, { ...mine, id: "r2", authorId: "someone-else", productId: 12, body: "Not mine to see here." }], votes: {}, hidden: {} });
    useReviewsStore.getState().hydrate();
    const user = userEvent.setup();
    renderWithClient(<MyReviewsSection />);

    const item = await screen.findByTestId("my-review");
    expect(screen.getAllByTestId("my-review")).toHaveLength(1);
    expect(await within(item).findByRole("link", { name: "Brass Lamp" })).toHaveAttribute("href", "/products/11");
    expect(within(item).getByText("Verified purchase")).toBeInTheDocument();
    expect(within(item).getByText("Published")).toBeInTheDocument();

    await user.click(within(item).getByRole("button", { name: /Edit your review/ }));
    const body = screen.getByRole("textbox");
    await user.clear(body);
    await user.type(body, "Updated: still lovely after a month of use.");
    await user.click(screen.getByRole("button", { name: /save|update/i }));
    expect(await screen.findByText(/Updated: still lovely/)).toBeInTheDocument();
    expect(useReviewsStore.getState().reviews.find((r) => r.id === "r1")?.updatedAt).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /Delete your review/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(useReviewsStore.getState().reviews.map((r) => r.id)).toEqual(["r2"]);
  });

  it("marks a review a moderator has hidden", async () => {
    saveReviewsData({ reviews: [mine], votes: {}, hidden: { r1: { reviewId: "r1", productId: 11, source: "shopper", authorName: "Uma", rating: 4, body: "x", hiddenAt: 1 } } });
    useReviewsStore.getState().hydrate();
    renderWithClient(<MyReviewsSection />);
    expect(await screen.findByText("Hidden by a moderator")).toBeInTheDocument();
  });
});

describe("RecentlyViewedSection (PRD 5.7)", () => {
  it("shows an empty state, then the full history newest first", async () => {
    const { unmount } = renderWithClient(<RecentlyViewedSection />);
    expect(await screen.findByText("Nothing viewed yet")).toBeInTheDocument();
    unmount();

    const base = { category: "home", brand: null, price: 1000, tags: [] };
    useViewedStore.setState({ items: [{ productId: 12, viewedAt: 2, ...base }, { productId: 11, viewedAt: 1, ...base }] });
    renderWithClient(<RecentlyViewedSection />);
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2));
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Clay Mug", "Brass Lamp"]);
  });
});
