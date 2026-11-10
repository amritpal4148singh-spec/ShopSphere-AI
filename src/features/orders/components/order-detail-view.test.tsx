
import { act, render, screen, within } from "@testing-library/react";

import { useOrdersStore } from "@/store/orders-store";
import { frozenOrder, makeOrder } from "@/test/orders";
import { OrderDetailView } from "./order-detail-view";

beforeEach(() => {
  localStorage.clear();
  useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
});

function seed(...orders: ReturnType<typeof makeOrder>[]) {
  useOrdersStore.getState().switchOwner("u1");
  useOrdersStore.setState({ orders });
}

describe("OrderDetailView (PRD MOD-08-001)", () => {
  it("shows a skeleton until orders are ready", () => {
    render(<OrderDetailView orderId="SS-20261014-ABCDE" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading your order");
  });

  it("shows a clear not-found page for an unknown order or another customer's order", () => {
    seed(makeOrder());
    render(<OrderDetailView orderId="SS-NOPE" />);

    expect(screen.getByRole("heading", { name: "Order not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your orders" })).toHaveAttribute("href", "/orders");
  });

  it("shows an in-progress order: Shipped is current, earlier stages have times, later ones are upcoming", () => {
    seed(frozenOrder("shipped", { id: "SS-SHIPPED" }));
    render(<OrderDetailView orderId="SS-SHIPPED" />);

    expect(screen.getByRole("heading", { level: 1, name: "Order SS-SHIPPED" })).toBeInTheDocument();

    const timeline = within(screen.getByRole("list", { name: "Order tracking" }));
    const items = timeline.getAllByRole("listitem");

    expect(items.map((item) => item.getAttribute("data-state"))).toEqual([
      "completed",
      "completed",
      "completed",
      "current",
      "upcoming",
      "upcoming",
    ]);

    expect(items[3]).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByText("Upcoming")).toHaveLength(2);
  });

  it("shows the items with quantities and prices, the address, delivery method and test-mode payment", () => {
    seed(makeOrder());
    render(<OrderDetailView orderId="SS-20261014-ABCDE" />);

    const items = within(screen.getByRole("list", { name: "Items in this order" }));

    expect(items.getByRole("link", { name: "Alpha Lamp" })).toHaveAttribute("href", "/products/1");
    expect(items.getByText("2 × ₹1,000")).toBeInTheDocument();
    expect(items.getByText("Size: M")).toBeInTheDocument();

    expect(screen.getByText("12 Demo Street", { exact: false })).toBeInTheDocument();

    expect(
      screen.getByRole("region", { name: "Delivery address" }),
    ).toHaveTextContent("New Delhi, Delhi 110001");

    expect(screen.getByText("Standard delivery")).toBeInTheDocument();
    expect(screen.getByText("Mock Card (test mode)")).toBeInTheDocument();
    expect(screen.getByText("No real payment was made.")).toBeInTheDocument();
  });

  it("shows the order totals, matching what was charged", () => {
    const order = makeOrder();
    seed(order);
    render(<OrderDetailView orderId={order.id} />);

    expect(screen.getByTestId("order-total")).toHaveTextContent(
      `₹${order.totals.total.toLocaleString("en-IN")}`,
    );
  });

  it("says tracking is simulated, and that a new order moves on its own", () => {
    seed(makeOrder());
    render(<OrderDetailView orderId="SS-20261014-ABCDE" />);

    expect(
      screen.getByText(/Tracking is simulated for this demo, and moves forward over a few minutes/),
    ).toBeInTheDocument();
  });

  it("does not claim sample orders move on their own", () => {
    seed(frozenOrder("packed", { id: "SS-P" }));
    render(<OrderDetailView orderId="SS-P" />);

    expect(screen.getByText("Tracking is simulated for this demo.")).toBeInTheDocument();
  });

  it("advances a new order's tracking while the page stays open", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });

    try {
      const placedAt = Date.now();

      seed(
        makeOrder({
          id: "SS-LIVE",
          placedAt,
          history: [{ status: "placed", at: placedAt }],
        }),
      );

      render(<OrderDetailView orderId="SS-LIVE" />);

      const timeline = within(screen.getByRole("list", { name: "Order tracking" }));

      expect(
        timeline.getAllByRole("listitem").map((item) => item.getAttribute("data-state"))[0],
      ).toBe("current");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(13 * 60_000);
      });

      expect(
        timeline.getAllByRole("listitem").every(
          (item) => item.getAttribute("data-state") === "completed",
        ),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
