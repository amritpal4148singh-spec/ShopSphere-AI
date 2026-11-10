import { render, screen } from "@testing-library/react";

import { useOrdersStore } from "@/store/orders-store";
import { makeOrder } from "@/test/orders";
import { OrderConfirmation } from "./order-confirmation";

beforeEach(() => {
  localStorage.clear();
  useOrdersStore.setState({ status: "idle", ownerId: null, orders: [] });
});

describe("OrderConfirmation (checkout step 6)", () => {
  it("shows the order number, a test-mode note, and the order contents", () => {
    useOrdersStore.getState().switchOwner("u1");
    useOrdersStore.setState({ orders: [makeOrder()] });
    render(<OrderConfirmation orderId="SS-20261014-ABCDE" />);

    expect(screen.getByRole("heading", { name: "Thank you, your order is placed" })).toBeInTheDocument();
    expect(screen.getByTestId("confirmation-order-id")).toHaveTextContent("SS-20261014-ABCDE");
    expect(screen.getByText(/test-mode order: no real payment was made/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alpha Lamp" })).toBeInTheDocument();
    expect(screen.getByText("Mock Card (test mode)")).toBeInTheDocument();
  });

  it("links to tracking and back to shopping", () => {
    useOrdersStore.getState().switchOwner("u1");
    useOrdersStore.setState({ orders: [makeOrder()] });
    render(<OrderConfirmation orderId="SS-20261014-ABCDE" />);

    expect(screen.getByRole("link", { name: "Track this order" })).toHaveAttribute("href", "/orders/SS-20261014-ABCDE");
    expect(screen.getByRole("link", { name: "Continue shopping" })).toHaveAttribute("href", "/products");
  });

  it("shows a skeleton while loading and a not-found page for an unknown order", () => {
    const { rerender } = render(<OrderConfirmation orderId="SS-X" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading your order");

    useOrdersStore.getState().switchOwner("u1");
    rerender(<OrderConfirmation orderId="SS-X" />);
    expect(screen.getByRole("heading", { name: "Order not found" })).toBeInTheDocument();
  });
});
