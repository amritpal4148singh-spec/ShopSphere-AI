import { SEED_CUSTOMER_ID } from "@/data/seed-data";
import { orderStorage } from "@/lib/order-storage";
import { frozenOrder } from "@/test/orders";
import { getOrderStatus } from "@/utils/orders";
import { useAdminOrdersStore } from "./admin-orders-store";

beforeEach(() => {
  localStorage.clear();
  useAdminOrdersStore.setState({ status: "idle", orders: [], saveFailed: false });
});

describe("useAdminOrdersStore (PRD 8.3)", () => {
  it("is idle until loaded", () => {
    expect(useAdminOrdersStore.getState().status).toBe("idle");
  });

  it("includes the demo customer's sample orders even on a fresh browser", () => {
    useAdminOrdersStore.getState().load();
    const { orders } = useAdminOrdersStore.getState();
    expect(orders.length).toBeGreaterThanOrEqual(5);
    expect(new Set(orders.map((entry) => entry.ownerId))).toEqual(new Set([SEED_CUSTOMER_ID]));
    expect(orders.map((entry) => entry.order.placedAt)).toEqual([...orders.map((entry) => entry.order.placedAt)].sort((a, b) => b - a));
  });

  it("reads the orders of every customer who has saved some", () => {
    orderStorage.save("user-abc".replace("user-", ""), [frozenOrder("packed", { id: "X-1" })]);
    useAdminOrdersStore.getState().load();
    const entry = useAdminOrdersStore.getState().orders.find((candidate) => candidate.order.id === "X-1");
    expect(entry?.ownerId).toBe("abc");
  });

  it("advances an order and writes it back to that customer's own storage", () => {
    orderStorage.save("abc", [frozenOrder("packed", { id: "X-1" })]);
    useAdminOrdersStore.getState().load();
    expect(useAdminOrdersStore.getState().advance("abc", "X-1")).toBe("advanced");
    const stored = orderStorage.load("abc")![0]!;
    expect(getOrderStatus(stored, Date.now())).toBe("shipped");
    expect(getOrderStatus(useAdminOrdersStore.getState().orders.find((e) => e.order.id === "X-1")!.order, Date.now())).toBe("shipped");
  });

  it("reports a delivered order and a missing one without changing anything", () => {
    orderStorage.save("abc", [frozenOrder("delivered", { id: "D-1" })]);
    useAdminOrdersStore.getState().load();
    expect(useAdminOrdersStore.getState().advance("abc", "D-1")).toBe("delivered");
    expect(useAdminOrdersStore.getState().advance("abc", "nope")).toBe("missing");
  });
});
