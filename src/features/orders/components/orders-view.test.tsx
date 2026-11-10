import { act, render, screen, within } from "@testing-library/react";

import { SEED_CUSTOMER_ID } from "@/data/seed-data";
import { useOrdersStore } from "@/store/orders-store";
import { makeOrder } from "@/test/orders";
import { OrdersView } from "./orders-view";

beforeEach(() => {
  localStorage.clear();
  useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
});

describe("OrdersView", () => {
  it("shows a skeleton until orders are ready", () => {
    render(<OrdersView />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your orders");
  });

  it("shows a helpful empty state for a customer with no orders (edge case 13)", () => {
    useOrdersStore.getState().switchOwner("brand-new-user");
    render(<OrdersView />);

    expect(screen.getByRole("heading", { name: "You have no orders yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start shopping" })).toHaveAttribute("href", "/products");
  });

  it("lists orders newest first, each linking to its detail page", () => {
    useOrdersStore.getState().switchOwner(SEED_CUSTOMER_ID);
    render(<OrdersView />);

    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links).toHaveLength(6);
    expect(links[0]).toHaveAttribute("href", "/orders/SS-DEMO-0006");
    expect(links[5]).toHaveAttribute("href", "/orders/SS-DEMO-0001");
  });

  it("shows each order's number, item count, total and its status (every PRD status appears)", () => {
    useOrdersStore.getState().switchOwner(SEED_CUSTOMER_ID);
    render(<OrdersView />);

    for (const label of ["Order Placed", "Confirmed", "Packed", "Shipped", "Out for Delivery", "Delivered"]) {
      expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    }
    expect(screen.getByText("SS-DEMO-0001")).toBeInTheDocument();
    expect(screen.getAllByText("3 items")).toHaveLength(2);
    expect(screen.getByText("6 orders")).toBeInTheDocument();
  });

  it("moves a new order's status forward over time", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      const placedAt = Date.now();
      useOrdersStore.getState().switchOwner("u1");
      useOrdersStore.setState({ orders: [makeOrder({ id: "SS-NEW", placedAt })] });
      render(<OrdersView />);
      expect(screen.getByText("Order Placed", { exact: true })).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(6 * 60_000));

      expect(screen.getByText("Shipped", { exact: true })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the singular for one order and one item", () => {
    useOrdersStore.getState().switchOwner("u1");
    useOrdersStore.setState({ orders: [makeOrder({ items: [{ productId: 1, title: "Lamp", thumbnail: null, variantLabel: null, quantity: 1, unitPrice: 1000 }] })] });
    render(<OrdersView />);
    expect(screen.getByText("1 order")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });
});
