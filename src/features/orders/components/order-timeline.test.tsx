import { render, screen, within } from "@testing-library/react";

import { frozenOrder } from "@/test/orders";
import { buildTimeline } from "@/utils/orders";
import { formatDateTime } from "@/lib/format";
import { OrderTimeline } from "./order-timeline";

describe("OrderTimeline (PRD MOD-08-001)", () => {
  const order = frozenOrder("shipped");
  const stages = buildTimeline(order, Date.now());

  it("lists all six stages in order", () => {
    render(<OrderTimeline stages={stages} />);

    const items = within(screen.getByRole("list", { name: "Order tracking" })).getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items.map((item) => item.querySelector("p")?.firstChild?.textContent)).toEqual([
      "Order Placed",
      "Confirmed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
    ]);
  });

  it("shows a timestamp for every completed and current stage and 'Upcoming' for the rest", () => {
    render(<OrderTimeline stages={stages} />);

    for (const stage of stages.slice(0, 4)) expect(screen.getByText(formatDateTime(stage.at as number))).toBeInTheDocument();
    expect(screen.getAllByText("Upcoming")).toHaveLength(2);
  });

  it("marks the current stage for assistive technology and says each state in text", () => {
    render(<OrderTimeline stages={stages} />);

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-state"))).toEqual(["completed", "completed", "completed", "current", "upcoming", "upcoming"]);
    expect(items[3]).toHaveAttribute("aria-current", "step");
    expect(items.filter((item) => item.hasAttribute("aria-current"))).toHaveLength(1);
    expect(screen.getByText(": Current stage")).toBeInTheDocument();
    expect(screen.getAllByText(": Completed")).toHaveLength(3);
    expect(screen.getAllByText(": Upcoming")).toHaveLength(2);
  });

  it("shows a delivered order as entirely completed, with no current stage", () => {
    render(<OrderTimeline stages={buildTimeline(frozenOrder("delivered"), Date.now())} />);

    expect(screen.getAllByRole("listitem").every((item) => item.getAttribute("data-state") === "completed")).toBe(true);
    expect(screen.queryByText("Upcoming")).not.toBeInTheDocument();
  });
});
