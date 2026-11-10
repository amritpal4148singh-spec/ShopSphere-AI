import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SEED_CUSTOMER_ID } from "@/data/seed-data";
import { loadAnalytics } from "@/lib/analytics-storage";
import { orderStorage } from "@/lib/order-storage";
import { loadReviewsData } from "@/lib/review-storage";
import { ApiError, fetchCatalog } from "@/services/products";
import { useAdminOrdersStore } from "@/store/admin-orders-store";
import { useAnalyticsStore } from "@/store/analytics-store";
import { useReviewsStore } from "@/store/reviews-store";
import { frozenOrder } from "@/test/orders";
import { renderWithClient } from "@/test/render";
import { AdminOrderDetailView } from "./admin-order-detail-view";
import { AdminOrdersView } from "./admin-orders-view";
import { AdminReviewsView } from "./admin-reviews-view";
import { AdminShell } from "./admin-shell";
import { AnalyticsView } from "./analytics-view";
import { OverviewView } from "./overview-view";
import { resetAdminWorld } from "./admin-test-utils";

vi.mock("@/services/products", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/products")>();
  return { ...actual, fetchCatalog: vi.fn(), searchProducts: vi.fn(), fetchCategories: vi.fn(), fetchSuggestions: vi.fn() };
});
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/products", useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

beforeEach(resetAdminWorld);

describe("OverviewView (PRD 8.1)", () => {
  it("shows a loading state first", () => {
    useAdminOrdersStore.setState({ status: "idle", orders: [] });
    renderWithClient(<OverviewView />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading the dashboard");
  });

  it("shows totals, with simulated figures labelled as such", async () => {
    renderWithClient(<OverviewView />);
    expect(await screen.findByRole("heading", { level: 1, name: "Admin dashboard" })).toBeInTheDocument();
    await screen.findByTestId("metric-total-products");
    expect(screen.getByTestId("metric-total-products")).toHaveTextContent("23");
    expect(screen.getByTestId("metric-total-orders")).toHaveTextContent("6");
    expect(screen.getByTestId("metric-total-customers").textContent).toMatch(/^\d+$/);
    expect(screen.getByTestId("metric-revenue").textContent).toMatch(/^₹/);
    expect(screen.getByTestId("metric-conversion-rate").textContent).toMatch(/%$/);
    // The intro sentence also says "Simulated"; the two figure tags are the spans.
    expect(screen.getAllByText("Simulated", { selector: "span" })).toHaveLength(2);
    expect(screen.getByText("Local Analytics", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/Signed in as/)).toBeInTheDocument();
  });

  it("ranks top products by simulated sales, or by rating", async () => {
    const user = userEvent.setup();
    renderWithClient(<OverviewView />);
    const sales = await screen.findByRole("list", { name: "Top products by simulated sales" });
    expect(within(sales).getAllByRole("listitem")).toHaveLength(5);
    expect(within(sales).getAllByRole("listitem")[0]).toHaveTextContent(/\d+ sold/);

    await user.click(screen.getByRole("button", { name: "By rating" }));
    const rating = screen.getByRole("list", { name: "Top products by rating" });
    expect(within(rating).getAllByRole("listitem")[0]).toHaveTextContent("P9");
    expect(screen.getByRole("button", { name: "By rating" })).toHaveAttribute("aria-pressed", "true");
  });

  it("lists low-stock alerts, and says when stock is healthy", async () => {
    renderWithClient(<OverviewView />);
    const alerts = await screen.findByRole("list", { name: "Products running low" });
    expect(within(alerts).getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open inventory" })).toHaveAttribute("href", "/admin/inventory");
  });

  it("shows the recommendation click-through from local analytics", async () => {
    useAnalyticsStore.getState().impressions("similar", 100);
    useAnalyticsStore.getState().click("similar", 3);
    renderWithClient(<OverviewView />);
    await screen.findByTestId("metric-recommendation-click-through");
    expect(screen.getByTestId("metric-recommendation-click-through").textContent).toMatch(/^\d+\.\d%$/);
  });

  it("keeps the other figures and offers a retry when the catalogue fails", async () => {
    vi.mocked(fetchCatalog).mockRejectedValue(new ApiError("http", "boom", 500));
    renderWithClient(<OverviewView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not load the product catalogue");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("AdminOrdersView (PRD 8.3)", () => {
  it("lists the demo customer's orders with customer, status and total", async () => {
    renderWithClient(<AdminOrdersView />);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(screen.getByText("6 orders")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "SS-DEMO-0001" })).toHaveAttribute("href", "/admin/orders/SS-DEMO-0001");
  });

  it("filters by status, customer and date range, and by order number", async () => {
    const user = userEvent.setup();
    orderStorage.save("second", [frozenOrder("shipped", { id: "SS-OTHER-1", customer: { name: "Zed Other", email: "zed@example.com", phone: "9876543210" } })]);
    useAdminOrdersStore.getState().load();
    renderWithClient(<AdminOrdersView />);
    await screen.findByRole("table");
    expect(screen.getByText("7 orders")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Customer"), "zed@example.com");
    expect(screen.getByText("1 order")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Customer"), "");
    await user.selectOptions(screen.getByLabelText("Status"), "shipped");
    expect(screen.getByRole("link", { name: "SS-OTHER-1" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status"), "all");

    await user.type(screen.getByLabelText("Order number"), "demo-0003");
    expect(screen.getByText("1 order")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Order number"));

    await user.type(screen.getByLabelText("Placed from"), "2099-01-01");
    expect(screen.getByRole("heading", { name: "No orders match these filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("7 orders")).toBeInTheDocument();
  });

  it("warns when the date range is reversed", async () => {
    const user = userEvent.setup();
    renderWithClient(<AdminOrdersView />);
    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Placed from"), "2026-10-20");
    await user.type(screen.getByLabelText("Placed until"), "2026-10-01");
    expect(screen.getByRole("alert")).toHaveTextContent("The start date is after the end date");
  });

  it("explains an empty system", async () => {
    useAdminOrdersStore.setState({ status: "ready", orders: [] });
    renderWithClient(<AdminOrdersView />);
    expect(await screen.findByRole("heading", { name: "No orders yet" })).toBeInTheDocument();
  });
});

describe("AdminOrderDetailView (PRD 8.3)", () => {
  it("shows items, customer, totals and tracking", async () => {
    renderWithClient(<AdminOrderDetailView orderId="SS-DEMO-0003" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Order SS-DEMO-0003" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Customer" })).toBeInTheDocument();
    expect(screen.getByText(SEED_CUSTOMER_ID)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tracking" })).toBeInTheDocument();
  });

  it("simulates advancing the order one stage at a time, saves it, and labels the action", async () => {
    const user = userEvent.setup();
    orderStorage.save("second", [frozenOrder("packed", { id: "SS-ADV-1" })]);
    useAdminOrdersStore.getState().load();
    renderWithClient(<AdminOrderDetailView orderId="SS-ADV-1" />);
    await screen.findByRole("heading", { level: 1, name: "Order SS-ADV-1" });
    expect(screen.getByText("Local simulation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Advance to Shipped" }));
    expect(screen.getByRole("status")).toHaveTextContent('Order moved to "Shipped" (local simulation)');
    expect(screen.getByRole("button", { name: "Advance to Out for Delivery" })).toBeInTheDocument();
    expect(orderStorage.load("second")![0]!.history.map((record) => record.status)).toEqual(["placed", "confirmed", "packed", "shipped"]);
  });

  it("has no advance button once delivered", async () => {
    orderStorage.save("second", [frozenOrder("delivered", { id: "SS-DONE-1" })]);
    useAdminOrdersStore.getState().load();
    renderWithClient(<AdminOrderDetailView orderId="SS-DONE-1" />);
    await screen.findByRole("heading", { level: 1, name: "Order SS-DONE-1" });
    expect(screen.queryByRole("button", { name: /Advance to/ })).toBeNull();
    expect(screen.getByText(/there is no later stage/)).toBeInTheDocument();
  });

  it("says an unknown order does not exist", async () => {
    renderWithClient(<AdminOrderDetailView orderId="NOPE" />);
    expect(await screen.findByRole("heading", { name: "Order not found" })).toBeInTheDocument();
  });
});

describe("AnalyticsView (PRD 8.4)", () => {
  it("is labelled Local Analytics and shows the sample baseline for all strategies", async () => {
    render(<AnalyticsView />);
    expect(await screen.findByRole("heading", { level: 1, name: "Recommendation analytics" })).toBeInTheDocument();
    expect(screen.getAllByText("Local Analytics").length).toBeGreaterThan(0);
    const table = screen.getByRole("table", { name: "Recommendation engagement by strategy" });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    for (const name of ["Similar Products", "Trending Products", "Cart-Based", "Frequently Bought Together", "Personalized For You"]) {
      expect(within(table).getByRole("rowheader", { name })).toBeInTheDocument();
    }
  });

  it("adds tracked events on top of the baseline, and can leave the baseline out", async () => {
    const user = userEvent.setup();
    useAnalyticsStore.getState().impressions("price-based", 7);
    render(<AnalyticsView />);
    const row = () => screen.getByRole("row", { name: /^Price-Based/ });
    await screen.findByRole("table");
    expect(within(row()).getAllByRole("cell")[0]).toHaveTextContent("267");

    await user.click(screen.getByRole("checkbox", { name: "Include simulated sample baseline" }));
    expect(within(row()).getAllByRole("cell")[0]).toHaveTextContent("7");
  });

  it("ranks strategies by engagement", async () => {
    render(<AnalyticsView />);
    const table = await screen.findByRole("table");
    const first = within(table).getAllByRole("row")[1]!;
    expect(first).toHaveTextContent("Similar Products");
  });

  it("shows an empty state with no baseline and nothing tracked", async () => {
    const user = userEvent.setup();
    render(<AnalyticsView />);
    await user.click(await screen.findByRole("checkbox", { name: "Include simulated sample baseline" }));
    expect(screen.getByRole("heading", { name: "No recommendation activity tracked yet" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("erases tracked events only after confirming, leaving the baseline", async () => {
    const user = userEvent.setup();
    useAnalyticsStore.getState().impressions("price-based", 7);
    render(<AnalyticsView />);
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Reset tracked events" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(loadAnalytics().counts["price-based"]?.impressions).toBe(7);

    await user.click(screen.getByRole("button", { name: "Reset tracked events" }));
    await user.click(screen.getByRole("button", { name: "Confirm reset" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tracked events were erased (local simulation)");
    expect(loadAnalytics().counts).toEqual({});
    expect(screen.getByRole("row", { name: /^Price-Based/ })).toHaveTextContent("260");
  });
});

describe("AdminReviewsView (PRD 4.3: Moderate)", () => {
  it("lists sample reviews and the reviews written on this device", async () => {
    useReviewsStore.getState().submit({ productId: 3, authorId: "u9", authorName: "Local Larry", rating: 4, body: "Written right here on the device.", verifiedPurchase: true });
    renderWithClient(<AdminReviewsView />);
    const list = await screen.findByRole("list", { name: "Reviews to moderate" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("22 reviews")).toBeInTheDocument();
    expect(screen.getByText("Written right here on the device.")).toBeInTheDocument();
    expect(screen.getAllByText("Written on this device")).toHaveLength(1);
  });

  it("hides and restores a review, reversibly and labelled as local", async () => {
    const user = userEvent.setup();
    renderWithClient(<AdminReviewsView />);
    await screen.findByRole("list", { name: "Reviews to moderate" });
    await user.type(screen.getByLabelText("Search reviews"), "Deepa Nair");

    await user.click(screen.getByRole("button", { name: "Hide review by Deepa Nair" }));
    expect(screen.getByRole("status")).toHaveTextContent("Review by Deepa Nair hidden (local simulation).");
    expect(Object.values(loadReviewsData().hidden)).toHaveLength(1);
    expect(screen.getByText("Hidden", { selector: "span" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore review by Deepa Nair" }));
    expect(loadReviewsData().hidden).toEqual({});
  });

  it("filters to hidden reviews and says when there are none", async () => {
    const user = userEvent.setup();
    renderWithClient(<AdminReviewsView />);
    await screen.findByRole("list", { name: "Reviews to moderate" });
    await user.selectOptions(screen.getByLabelText("Show"), "hidden");
    expect(screen.getByRole("heading", { name: "No reviews to show" })).toBeInTheDocument();
  });

  it("keeps a hidden product API review restorable from its snapshot", async () => {
    const user = userEvent.setup();
    useReviewsStore.getState().hide({ reviewId: "catalogue-3-0", productId: 3, source: "catalogue", authorName: "Api Annie", rating: 2, body: "Hidden API review." });
    renderWithClient(<AdminReviewsView />);
    await screen.findByRole("list", { name: "Reviews to moderate" });
    await user.selectOptions(screen.getByLabelText("Show"), "hidden");
    expect(screen.getByText("Hidden API review.")).toBeInTheDocument();
    expect(screen.getByText("Product API")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore review by Api Annie" }));
    expect(loadReviewsData().hidden).toEqual({});
  });
});

describe("AdminShell", () => {
  it("labels every admin screen as a local simulation and marks the current section", () => {
    render(
      <AdminShell>
        <p>Child content</p>
      </AdminShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Admin sections" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Overview", "Products", "Inventory", "Categories", "Orders", "Reviews", "Analytics"]);
    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("note")).toHaveTextContent(/simulated and saved in this browser/);
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("loads the local data the screens need", async () => {
    useAdminOrdersStore.setState({ status: "idle", orders: [] });
    render(
      <AdminShell>
        <p>x</p>
      </AdminShell>,
    );
    await waitFor(() => expect(useAdminOrdersStore.getState().status).toBe("ready"));
  });
});
