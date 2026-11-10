import { frozenOrder, makeOrder } from "@/test/orders";
import type { AdminOrder } from "@/types/admin";
import { DEFAULT_ORDER_FILTERS, advanceOrder, customerOptions, filterAdminOrders, nextStatus } from "./admin-orders";
import { getOrderStatus } from "./orders";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const orders: AdminOrder[] = [
  { ownerId: "u1", order: frozenOrder("packed", { id: "A-1", placedAt: Date.UTC(2026, 9, 10, 8), customer: { name: "Asha Rao", email: "Asha@Example.com", phone: "9876543210" } }) },
  { ownerId: "u2", order: frozenOrder("delivered", { id: "B-2", placedAt: Date.UTC(2026, 9, 15, 8), customer: { name: "Ravi Iyer", email: "ravi@example.com", phone: "9876543210" } }) },
  { ownerId: "u1", order: frozenOrder("shipped", { id: "A-3", placedAt: Date.UTC(2026, 9, 18, 8), customer: { name: "Asha Rao", email: "asha@example.com", phone: "9876543210" } }) },
];
const ids = (list: AdminOrder[]) => list.map((entry) => entry.order.id);

describe("filterAdminOrders (PRD 8.3)", () => {
  it("returns everything with the default filters", () => {
    expect(ids(filterAdminOrders(orders, DEFAULT_ORDER_FILTERS, NOW))).toEqual(["A-1", "B-2", "A-3"]);
  });

  it("filters by status", () => {
    expect(ids(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, status: "delivered" }, NOW))).toEqual(["B-2"]);
  });

  it("filters by customer email regardless of case", () => {
    expect(ids(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, customer: "asha@example.com" }, NOW))).toEqual(["A-1", "A-3"]);
  });

  it("filters by an inclusive date range", () => {
    const range = { ...DEFAULT_ORDER_FILTERS, from: "2026-10-15", to: "2026-10-15" };
    expect(ids(filterAdminOrders(orders, range, NOW))).toEqual(["B-2"]);
    expect(ids(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, from: "2026-10-16" }, NOW))).toEqual(["A-3"]);
    expect(ids(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, to: "2026-10-10" }, NOW))).toEqual(["A-1"]);
  });

  it("returns nothing for a reversed range, and ignores a malformed date", () => {
    expect(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, from: "2026-10-20", to: "2026-10-01" }, NOW)).toEqual([]);
    expect(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, from: "not a date" }, NOW)).toHaveLength(3);
  });

  it("finds an order by number, and combines filters", () => {
    expect(ids(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, query: "b-2" }, NOW))).toEqual(["B-2"]);
    expect(ids(filterAdminOrders(orders, { ...DEFAULT_ORDER_FILTERS, customer: "asha@example.com", status: "shipped" }, NOW))).toEqual(["A-3"]);
  });

  it("uses the time-derived status of auto-progressing orders", () => {
    const fresh: AdminOrder = { ownerId: "u3", order: makeOrder({ id: "N-1", placedAt: NOW - 6 * 60_000 }) };
    expect(getOrderStatus(fresh.order, NOW)).toBe("shipped");
    expect(ids(filterAdminOrders([fresh], { ...DEFAULT_ORDER_FILTERS, status: "shipped" }, NOW))).toEqual(["N-1"]);
  });
});

describe("customerOptions", () => {
  it("lists each customer once, by lower-case email", () => {
    expect(customerOptions(orders)).toEqual([
      { email: "asha@example.com", name: "Asha Rao" },
      { email: "ravi@example.com", name: "Ravi Iyer" },
    ]);
  });
});

describe("advanceOrder (PRD 8.3: simulate advancing along the timeline)", () => {
  it("adds the next stage with the current time and keeps earlier timestamps", () => {
    const order = frozenOrder("packed");
    expect(nextStatus(order, NOW)).toBe("shipped");
    const next = advanceOrder(order, NOW)!;
    expect(next.history.map((record) => record.status)).toEqual(["placed", "confirmed", "packed", "shipped"]);
    expect(next.history[3]?.at).toBe(NOW);
    expect(next.history.slice(0, 3)).toEqual(order.history);
    expect(getOrderStatus(next, NOW)).toBe("shipped");
  });

  it("freezes a time-driven order at the stage it had reached, then moves it on one step", () => {
    const order = makeOrder({ placedAt: NOW - 3 * 60_000 });
    expect(getOrderStatus(order, NOW)).toBe("packed");
    const next = advanceOrder(order, NOW)!;
    expect(next.autoProgress).toBe(false);
    expect(getOrderStatus(next, NOW + 60 * 60_000)).toBe("shipped");
  });

  it("can walk an order all the way to delivered, and then stops", () => {
    let order = frozenOrder("placed");
    for (let step = 0; step < 5; step += 1) order = advanceOrder(order, NOW + step)!;
    expect(getOrderStatus(order, NOW)).toBe("delivered");
    expect(advanceOrder(order, NOW)).toBeNull();
    expect(nextStatus(order, NOW)).toBeNull();
  });
});
