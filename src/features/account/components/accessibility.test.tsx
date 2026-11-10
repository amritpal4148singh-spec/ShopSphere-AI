import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Dialog } from "@/components/ui/dialog";
import { SiteFooter } from "@/components/layout/site-footer";
import { CompareView } from "@/features/compare";
import { ProductCard } from "@/features/products";
import { fetchCatalog, fetchProduct } from "@/services/products";
import { useAddressStore } from "@/store/address-store";
import { useCompareStore } from "@/store/compare-store";
import { useProfileStore } from "@/store/profile-store";
import { useReviewsStore } from "@/store/reviews-store";
import { useViewedStore } from "@/store/viewed-store";
import { axeViolations } from "@/test/axe";
import { makeProduct, makeProductDetail } from "@/test/fixtures";
import { renderWithClient } from "@/test/render";
import { CUSTOMER, signInAs } from "@/test/session";
import { AddressesSection } from "./addresses-section";
import { MyReviewsSection } from "./my-reviews-section";
import { ProfileSection } from "./profile-section";
import { RecentlyViewedSection } from "./recently-viewed-section";

vi.mock("next/navigation", async () => (await import("@/test/navigation-mock")).navigationMock);
vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), fetchProduct: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});

const lamp = makeProductDetail({ id: 1, title: "Brass Lamp" });
const mug = makeProductDetail({ id: 2, title: "Clay Mug", stock: 0, availability: "out-of-stock" });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(fetchCatalog).mockReset().mockResolvedValue([lamp, mug]);
  vi.mocked(fetchProduct).mockReset().mockImplementation(async (id: number) => (id === 1 ? lamp : mug));
  signInAs(CUSTOMER);
  useProfileStore.setState({ status: "idle", ownerId: null, saved: null });
  useProfileStore.getState().switchOwner(CUSTOMER.id);
  useAddressStore.setState({ status: "idle", ownerId: null, addresses: [] });
  useAddressStore.getState().switchOwner(CUSTOMER.id);
  useReviewsStore.setState({ status: "ready", saveFailed: false, reviews: [], votes: {}, hidden: {} });
  useViewedStore.setState({ status: "ready", items: [] });
  useCompareStore.setState({ status: "idle", items: [], lastOutcome: null });
  useCompareStore.getState().hydrate();
});

describe("automated accessibility checks (axe-core, PRD 14)", () => {
  it("footer, with its labelled navigation groups and newsletter form", async () => {
    const { container } = render(<SiteFooter />);
    expect(await axeViolations(container)).toBe("");
  });

  it("profile form, including its error state", async () => {
    const user = userEvent.setup();
    const { container } = renderWithClient(<ProfileSection />);
    expect(await axeViolations(container)).toBe("");
    await user.clear(screen.getByLabelText("Full name"));
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await axeViolations(container)).toBe("");
  });

  it("address book, empty, with the add form open and showing errors, and with saved addresses", async () => {
    const user = userEvent.setup();
    const { container, unmount } = renderWithClient(<AddressesSection />);
    expect(await axeViolations(container)).toBe("");
    await user.click(screen.getByRole("button", { name: "Add your first address" }));
    await user.click(screen.getByRole("button", { name: "Save address" }));
    expect(await axeViolations(container)).toBe("");
    unmount();

    useAddressStore.getState().add({ line1: "1 First Road", line2: "", city: "Pune", state: "Maharashtra", pincode: "411001" }, "Home");
    const again = renderWithClient(<AddressesSection />);
    await user.click(screen.getByRole("button", { name: "Delete Home" }));
    expect(await axeViolations(again.container)).toBe("");
  });

  it("my reviews and recently viewed, in their empty states", async () => {
    const reviews = renderWithClient(<MyReviewsSection />);
    await screen.findByText("You have not written any reviews yet");
    expect(await axeViolations(reviews.container)).toBe("");
    reviews.unmount();
    const viewed = renderWithClient(<RecentlyViewedSection />);
    await screen.findByText("Nothing viewed yet");
    expect(await axeViolations(viewed.container)).toBe("");
  });

  it("product card with its Quick view and Compare controls", async () => {
    const { container } = renderWithClient(<ul><li><ProductCard product={makeProduct({ id: 5, title: "Desk Organiser" })} /></li></ul>);
    expect(await axeViolations(container)).toBe("");
  });

  it("an open dialog (Quick View) is a valid named modal", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductCard product={makeProduct({ id: 1, title: "Brass Lamp" })} />);
    await user.click(screen.getByRole("button", { name: "Quick view Brass Lamp" }));
    const dialog = await screen.findByRole("dialog", { name: "Brass Lamp" });
    await screen.findByRole("button", { name: "Add to Cart" });
    expect(await axeViolations(dialog)).toBe("");
  });

  it("the generic dialog primitive", async () => {
    render(<Dialog open onClose={() => undefined} title="Example"><p>Body</p></Dialog>);
    expect(await axeViolations(screen.getByRole("dialog"))).toBe("");
  });

  it("the comparison table", async () => {
    useCompareStore.getState().add({ productId: 1, title: "Brass Lamp", thumbnail: null, category: "home" });
    useCompareStore.getState().add({ productId: 2, title: "Clay Mug", thumbnail: null, category: "home" });
    const { container } = renderWithClient(<CompareView />);
    await screen.findByRole("columnheader", { name: /Brass Lamp/ });
    await screen.findByRole("row", { name: /Warranty/ });
    expect(await axeViolations(container)).toBe("");
  });
});
